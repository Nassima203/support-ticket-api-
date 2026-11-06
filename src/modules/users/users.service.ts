import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/mailer";
import { invitationEmail } from "../../lib/emails";
import { generateToken, hashToken } from "../../lib/tokens";
import { HttpError } from "../../lib/http-error";
import { pageArgs, pageResult } from "../../lib/pagination";
import { CurrentUser } from "../../types/current-user";
import { ListUsersQuery } from "./users.schemas";
import { recordAudit } from "../audit/audit.service";

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
export function canManage(managerRole: Role, targetRole: Role): boolean {
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
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name, role },
      select: userFields,
    });

    await recordAudit(tx, { action: "USER_CREATED", actorId: manager.id, targetUserId: created.id, details: { role } });

    return created;
  });

  await sendInvitation(user.id, user.email);

  return user;
}

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { ...userFields, passwordHash: true },
      ...pageArgs(query),
    }),
    prisma.user.count({ where }),
  ]);

  // On remplace l'empreinte du mot de passe par une simple information : invitation acceptée ou non
  const data = users.map(({ passwordHash, ...user }) => ({
    ...user,
    invitationPending: passwordHash === null,
  }));

  return pageResult(data, total, query);
}

export async function resendInvitation(manager: CurrentUser, id: number) {
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) throw new HttpError(404, "Utilisateur introuvable");
  if (!canManage(manager.role, user.role)) throw new HttpError(403, "Tu ne peux pas gérer ce compte");
  if (user.passwordHash !== null) throw new HttpError(400, "Cette personne a déjà accepté son invitation");

  await sendInvitation(user.id, user.email);
}

// Retrouve un compte que la personne connectée a le droit de modifier, ou lève une erreur
async function findManageableUser(manager: CurrentUser, id: number) {
  // On ne modifie pas son propre compte : un admin ne doit pas pouvoir se bloquer ou se rétrograder par erreur
  if (id === manager.id) throw new HttpError(400, "Tu ne peux pas modifier ton propre compte");

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) throw new HttpError(404, "Utilisateur introuvable");
  if (!canManage(manager.role, user.role)) throw new HttpError(403, "Tu ne peux pas gérer ce compte");

  return user;
}

// Désactiver ou réactiver un compte
export async function setUserActive(manager: CurrentUser, id: number, isActive: boolean) {
  const target = await findManageableUser(manager, id);

  // Déjà dans l'état demandé : rien à changer, rien à enregistrer
  if (target.isActive === isActive) {
    return prisma.user.findUniqueOrThrow({ where: { id }, select: userFields });
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { isActive },
      select: userFields,
    });

    // Un compte désactivé perd toutes ses sessions. Ses access tokens sont déjà refusés par authenticate.
    if (!isActive) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await recordAudit(tx, {
      action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      actorId: manager.id,
      targetUserId: id,
    });

    return user;
  });
}

// Changer le rôle d'un compte
export async function changeUserRole(manager: CurrentUser, id: number, role: Role) {
  const target = await findManageableUser(manager, id);

  // Un ADMIN ne peut pas non plus donner un rôle qu'il ne gère pas (par exemple ADMIN)
  if (!canManage(manager.role, role)) throw new HttpError(403, "Tu ne peux pas donner ce rôle");

  // Déjà ce rôle : rien à changer, rien à enregistrer
  if (target.role === role) {
    return prisma.user.findUniqueOrThrow({ where: { id }, select: userFields });
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { role },
      select: userFields,
    });

    await recordAudit(tx, {
      action: "ROLE_CHANGED",
      actorId: manager.id,
      targetUserId: id,
      details: { from: target.role, to: role },
    });

    return user;
  });
}
