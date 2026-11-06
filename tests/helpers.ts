import request from "supertest";
import { Role } from "@prisma/client";
import { vi } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";
import { sendEmail } from "../src/lib/mailer";

export const PASSWORD = "MotDePasse123";

export function api() {
  return request(app);
}

// Vide toutes les tables et remet les compteurs d'id à 1.
// Sécurité : refuse de vider une base dont le nom ne finit pas par _test (la base de dev par exemple)
export async function resetDatabase() {
  const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refus de vider la base "${databaseName}" : son nom doit finir par _test`);
  }

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_logs", "password_reset_tokens", "refresh_tokens", "invitations", "tickets", "users" RESTART IDENTITY CASCADE',
  );
  vi.mocked(sendEmail).mockClear();
}

// bcrypt est lent exprès : on calcule l'empreinte du mot de passe de test une seule fois
let passwordHash: string | undefined;
let counter = 0;

type UserOptions = { email?: string; isActive?: boolean; invited?: boolean };

// Crée un compte directement en base. invited: true = invitation pas encore acceptée (pas de mot de passe)
export async function createUser(role: Role, options: UserOptions = {}) {
  passwordHash ??= await hashPassword(PASSWORD);
  counter++;

  return prisma.user.create({
    data: {
      email: options.email ?? `${role.toLowerCase()}${counter}@test.com`,
      role,
      isActive: options.isActive ?? true,
      passwordHash: options.invited ? null : passwordHash,
    },
  });
}

export async function login(email: string, password = PASSWORD) {
  const res = await api().post("/auth/login").send({ email, password });
  return res.body as { accessToken: string; refreshToken: string };
}

// Crée un compte et se connecte avec : renvoie le compte et ses jetons
export async function createUserAndLogin(role: Role) {
  const user = await createUser(role);
  const tokens = await login(user.email);
  return { user, token: tokens.accessToken, refreshToken: tokens.refreshToken };
}

// Les emails "envoyés" pendant le test
export function sentEmails() {
  return vi.mocked(sendEmail).mock.calls.map(([email]) => email);
}

// Le jeton contenu dans le lien du dernier email envoyé (invitation ou réinitialisation)
export function lastEmailToken(): string {
  const match = sentEmails().at(-1)?.text.match(/token=([a-f0-9]{64})/);
  if (!match) throw new Error("Aucun email avec un jeton n'a été envoyé");
  return match[1];
}
