import { z } from "zod";
import { Role } from "@prisma/client";
import { emailField } from "../../lib/schemas";
import { paginationFields } from "../../lib/pagination";

// Rôles qu'on peut donner par l'API (le SUPER_ADMIN n'est créé que par le seed)
const ASSIGNABLE_ROLES = ["ADMIN", "AGENT", "USER"] as const;

const roleField = z.enum(ASSIGNABLE_ROLES, {
  error: `Rôle invalide. Valeurs possibles : ${ASSIGNABLE_ROLES.join(", ")}`,
});

export const createUserSchema = z.object({
  email: emailField,
  name: z
    .string({ error: "name doit être un texte" })
    .trim()
    .min(1, { error: "name ne peut pas être vide" })
    .max(100, { error: "name ne doit pas dépasser 100 caractères" })
    .nullish(),
  role: roleField,
});

export const setStatusSchema = z.object({
  isActive: z.boolean({ error: "isActive doit être true ou false" }),
});

export const changeRoleSchema = z.object({
  role: roleField,
});

// GET /users?role=AGENT&isActive=true&page=1&limit=20
export const listUsersQuerySchema = z.object({
  role: z.enum(Role, { error: `Rôle invalide. Valeurs possibles : ${Object.values(Role).join(", ")}` }).optional(),
  isActive: z
    .enum(["true", "false"], { error: "isActive doit être true ou false" })
    .transform((value) => value === "true")
    .optional(),
  ...paginationFields,
});

export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;
