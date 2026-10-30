import { Router, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/mailer";
import { invitationEmail } from "../../lib/emails";
import { generateToken, hashToken } from "../../lib/tokens";
import { normalizeEmail } from "../../lib/normalize-email";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";

export const usersRouter = Router();

// Toutes les routes des utilisateurs : connecté ET admin ou super admin
usersRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

const INVITATION_HOURS = 48;

// Rôles qu'on peut donner par l'API (le SUPER_ADMIN n'est créé que par le seed)
const CREATABLE_ROLES: Role[] = ["ADMIN", "AGENT", "USER"];

// Ce qu'on renvoie d'un utilisateur (jamais son mot de passe)
const userFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// Vérification simple du format d'un email
function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Transforme "12" en 12, ou renvoie null si ce n'est pas un entier positif
function parseId(value: string | string[]): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

// Créer un utilisateur et l'inviter : POST /users
usersRouter.post("/", async (req: Request, res: Response) => {
  const { name, role } = req.body ?? {};
  const email = normalizeEmail(req.body?.email);

  if (!isEmail(email)) {
    res.status(400).json({ error: "Un email valide est obligatoire" });
    return;
  }

  if (!CREATABLE_ROLES.includes(role)) {
    res.status(400).json({ error: `Rôle invalide. Valeurs possibles : ${CREATABLE_ROLES.join(", ")}` });
    return;
  }

  if (!canManage(req.user!.role, role)) {
    res.status(403).json({ error: "Tu ne peux pas créer un compte avec ce rôle" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email" });
    return;
  }

  // Compte créé sans mot de passe : la personne le choisira en acceptant l'invitation
  const user = await prisma.user.create({
    data: { email, name: typeof name === "string" ? name : null, role },
    select: userFields,
  });

  await sendInvitation(user.id, user.email);

  res.status(201).json(user);
});

// Lister les utilisateurs : GET /users
usersRouter.get("/", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { ...userFields, passwordHash: true },
  });

  // On remplace l'empreinte du mot de passe par une simple information : invitation acceptée ou non
  res.json(
    users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      invitationPending: user.passwordHash === null,
    })),
  );
});

// Renvoyer une invitation : POST /users/:id/resend-invitation
usersRouter.post("/:id/resend-invitation", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(400).json({ error: "L'id doit être un nombre entier positif" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (!canManage(req.user!.role, user.role)) {
    res.status(403).json({ error: "Tu ne peux pas gérer ce compte" });
    return;
  }

  if (user.passwordHash !== null) {
    res.status(400).json({ error: "Cette personne a déjà accepté son invitation" });
    return;
  }

  await sendInvitation(user.id, user.email);

  res.json({ message: "Invitation renvoyée" });
});
