import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateToken, hashToken, refreshTokenExpiry, signAccessToken } from "../../lib/tokens";
import { sendEmail } from "../../lib/mailer";
import { passwordResetEmail } from "../../lib/emails";
import { HttpError } from "../../lib/http-error";

const RESET_TOKEN_MINUTES = 60;

// Crée une session : un access token (15 min) et un refresh token (7 jours) enregistré en base
async function createSession(userId: number, role: Role) {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = generateToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId,
      expiresAt: refreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Même message dans tous les cas d'échec : on ne révèle pas si l'email existe
  const valid =
    user !== null &&
    user.isActive &&
    user.passwordHash !== null &&
    (await verifyPassword(password, user.passwordHash));

  if (!user || !valid) throw new HttpError(401, "Email ou mot de passe incorrect");

  const tokens = await createSession(user.id, user.role);

  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export async function refresh(refreshToken: string) {
  // On retrouve la session grâce à l'empreinte du jeton
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });

  if (!stored) throw new HttpError(401, "Session invalide");

  // Jeton déjà utilisé : quelqu'un a pu le voler. On ferme toutes les sessions de ce compte.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Session révoquée, reconnecte-toi");
  }

  if (stored.expiresAt < new Date() || !stored.user.isActive) {
    throw new HttpError(401, "Session expirée ou compte désactivé");
  }

  // Rotation : l'ancien refresh token est révoqué, un nouveau le remplace
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return createSession(stored.user.id, stored.user.role);
}

// Si le jeton n'existe pas, on ne dit rien : rien à révéler
export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function acceptInvitation(token: string, password: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  // Même message pour un jeton faux, déjà utilisé ou expiré
  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    throw new HttpError(400, "Invitation invalide ou expirée");
  }

  const passwordHash = await hashPassword(password);

  // On marque l'invitation comme utilisée SEULEMENT si elle ne l'est pas encore.
  // Si deux requêtes arrivent en même temps, une seule réussit.
  const accepted = await prisma.$transaction(async (tx) => {
    const marked = await tx.invitation.updateMany({
      where: { id: invitation.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (marked.count !== 1) return false;

    await tx.user.update({
      where: { id: invitation.userId },
      data: { passwordHash },
    });

    return true;
  });

  if (!accepted) throw new HttpError(400, "Invitation invalide ou expirée");
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // On envoie un lien seulement si le compte existe, est actif et a déjà un mot de passe
  if (!user || !user.isActive || user.passwordHash === null) return;

  // L'ancien lien non utilisé ne sert plus
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  const token = generateToken();

  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000),
    },
  });

  await sendEmail(passwordResetEmail(user.email, token));
}

export async function resetPassword(token: string, password: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.user.isActive) {
    throw new HttpError(400, "Lien invalide ou expiré");
  }

  const passwordHash = await hashPassword(password);

  const done = await prisma.$transaction(async (tx) => {
    // Le lien ne sert qu'une fois, même si deux requêtes arrivent en même temps
    const marked = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (marked.count !== 1) return false;

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Par sécurité, toutes les sessions ouvertes sont fermées
    await tx.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return true;
  });

  if (!done) throw new HttpError(400, "Lien invalide ou expiré");
}

export function getProfile(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
}
