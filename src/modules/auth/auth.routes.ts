import { Router, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateToken, hashToken, refreshTokenExpiry, signAccessToken } from "../../lib/tokens";
import { normalizeEmail } from "../../lib/normalize-email";
import { sendEmail } from "../../lib/mailer";
import { passwordResetEmail } from "../../lib/emails";
import { authenticate } from "../../middlewares/authenticate";
import { loginLimiter, passwordResetLimiter } from "../../middlewares/rate-limit";

export const authRouter = Router();

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

// Se connecter : POST /auth/login
authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || typeof password !== "string" || !password) {
    res.status(400).json({ error: "email et password sont obligatoires" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Même message dans tous les cas d'échec : on ne révèle pas si l'email existe
  const valid =
    user !== null &&
    user.isActive &&
    user.passwordHash !== null &&
    (await verifyPassword(password, user.passwordHash));

  if (!user || !valid) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const tokens = await createSession(user.id, user.role);

  res.json({
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// Obtenir de nouveaux jetons : POST /auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken est obligatoire" });
    return;
  }

  // On retrouve la session grâce à l'empreinte du jeton
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });

  if (!stored) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }

  // Jeton déjà utilisé : quelqu'un a pu le voler. On ferme toutes les sessions de ce compte.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(401).json({ error: "Session révoquée, reconnecte-toi" });
    return;
  }

  if (stored.expiresAt < new Date() || !stored.user.isActive) {
    res.status(401).json({ error: "Session expirée ou compte désactivé" });
    return;
  }

  // Rotation : l'ancien refresh token est révoqué, un nouveau le remplace
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await createSession(stored.user.id, stored.user.role);

  res.json(tokens);
});

// Se déconnecter : POST /auth/logout
authRouter.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken est obligatoire" });
    return;
  }

  // On révoque la session. Si le jeton n'existe pas, on répond pareil : rien à révéler.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.status(204).end();
});

// Accepter une invitation et choisir son mot de passe : POST /auth/accept-invitation
authRouter.post("/accept-invitation", async (req: Request, res: Response) => {
  const { token, password } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token est obligatoire" });
    return;
  }

  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" });
    return;
  }

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  // Même message pour un jeton faux, déjà utilisé ou expiré
  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
    res.status(400).json({ error: "Invitation invalide ou expirée" });
    return;
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

  if (!accepted) {
    res.status(400).json({ error: "Invitation invalide ou expirée" });
    return;
  }

  res.json({ message: "Mot de passe enregistré, tu peux te connecter" });
});

// Demander un lien de réinitialisation : POST /auth/forgot-password
authRouter.post("/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400).json({ error: "email est obligatoire" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // On envoie un lien seulement si le compte existe, est actif et a déjà un mot de passe
  if (user && user.isActive && user.passwordHash !== null) {
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

  // Toujours la même réponse : on ne révèle pas quels emails ont un compte
  res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" });
});

// Choisir un nouveau mot de passe : POST /auth/reset-password
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body ?? {};

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token est obligatoire" });
    return;
  }

  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères" });
    return;
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.user.isActive) {
    res.status(400).json({ error: "Lien invalide ou expiré" });
    return;
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

  if (!done) {
    res.status(400).json({ error: "Lien invalide ou expiré" });
    return;
  }

  res.json({ message: "Mot de passe modifié, tu peux te connecter" });
});

// Voir son propre compte : GET /auth/me
authRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  res.json(user);
});
