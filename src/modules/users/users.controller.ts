import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../../lib/http-error";
import { normalizeEmail } from "../../lib/normalize-email";
import { parseId } from "../../lib/parse-id";
import * as usersService from "./users.service";

// Rôles qu'on peut donner par l'API (le SUPER_ADMIN n'est créé que par le seed)
const CREATABLE_ROLES: Role[] = ["ADMIN", "AGENT", "USER"];

// Vérification simple du format d'un email
function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// POST /users
export async function create(req: Request, res: Response) {
  const { name, role } = req.body ?? {};
  const email = normalizeEmail(req.body?.email);

  if (!isEmail(email)) {
    throw new HttpError(400, "Un email valide est obligatoire");
  }

  if (!CREATABLE_ROLES.includes(role)) {
    throw new HttpError(400, `Rôle invalide. Valeurs possibles : ${CREATABLE_ROLES.join(", ")}`);
  }

  const user = await usersService.createUser(req.user!, email, typeof name === "string" ? name : null, role);
  res.status(201).json(user);
}

// GET /users
export async function list(_req: Request, res: Response) {
  const users = await usersService.listUsers();
  res.json(users);
}

// POST /users/:id/resend-invitation
export async function resendInvitation(req: Request, res: Response) {
  const id = parseId(req.params.id);
  await usersService.resendInvitation(req.user!, id);
  res.json({ message: "Invitation renvoyée" });
}
