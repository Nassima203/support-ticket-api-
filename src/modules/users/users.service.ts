import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/mailer";
import { invitationEmail } from "../../lib/emails";
import { generateToken, hashToken } from "../../lib/tokens";
import { HttpError } from "../../lib/http-error";
import { CurrentUser } from "../../types/current-user";

const INVITATION_HOURS = 48;

// Ce qu'on renvoie d'un utilisateur (jamais son mot de passe)
const userFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// Un ADMIN ne gère que les AGENT et les USER. Le SUPER_ADMIN gère tout le monde sauf un autre SUPER_ADMIN.
function canManage(managerRole: Role, targetRole: Role): boolean {
  if (targetRole === "SUPER_ADMIN") return false;
  if (managerRole === "SUPER_ADMIN") return true;
  return targetRole === "AGENT" || targetRole === "USER";
}

// Crée une invitation (l'ancienne non utilisée est supprimée) et envoie l'email
async function sendInvitation(userId: number, email: string) {
  await prisma.invitation.deleteMany({ where: { userId, usedAt: null } });

  const token = generateToken();

  await prisma.invitation.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000),
    },
  });

  await sendEmail(invitationEmail(email, token));
}

export async function createUser(manager: CurrentUser, email: string, name: string | null, role: Role) {
  if (!canManage(manager.role, role)) {
    throw new HttpError(403, "Tu ne peux pas créer un compte avec ce rôle");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "Un compte existe déjà avec cet email");

  // Compte créé sans mot de passe : la personne le choisira en acceptant l'invitation
  const user = await prisma.user.create({
    data: { email, name, role },
    select: userFields,
  });

  await sendInvitation(user.id, user.email);

  return user;
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { ...userFields, passwordHash: true },
  });

  // On remplace l'empreinte du mot de passe par une simple information : invitation acceptée ou non
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    invitationPending: user.passwordHash === null,
  }));
}

export async function resendInvitation(manager: CurrentUser, id: number) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) throw new HttpError(404, "Utilisateur introuvable");
  if (!canManage(manager.role, user.role)) throw new HttpError(403, "Tu ne peux pas gérer ce compte");
  if (user.passwordHash !== null) throw new HttpError(400, "Cette personne a déjà accepté son invitation");

  await sendInvitation(user.id, user.email);
}
