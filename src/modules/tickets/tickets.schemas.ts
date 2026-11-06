import { z } from "zod";
import { TicketStatus } from "@prisma/client";
import { paginationFields } from "../../lib/pagination";

// Les 4 statuts autorisés : OPEN, IN_PROGRESS, RESOLVED, CLOSED
const statusField = z.enum(TicketStatus, {
  error: `Statut invalide. Valeurs possibles : ${Object.values(TicketStatus).join(", ")}`,
});

export const createTicketSchema = z.object({
  title: z
    .string({ error: "title et description sont obligatoires" })
    .trim()
    .min(1, { error: "title et description sont obligatoires" })
    .max(150, { error: "title ne doit pas dépasser 150 caractères" }),
  description: z
    .string({ error: "title et description sont obligatoires" })
    .trim()
    .min(1, { error: "title et description sont obligatoires" })
    .max(5000, { error: "description ne doit pas dépasser 5000 caractères" }),
});

// GET /tickets?status=OPEN&search=connexion&page=1&limit=20&sortBy=createdAt&order=desc
export const listTicketsQuerySchema = z.object({
  status: statusField.optional(),
  search: z.string({ error: "search doit être un texte" }).trim().min(1).max(100).optional(),
  ...paginationFields,
  sortBy: z
    .enum(["createdAt", "updatedAt", "status", "title"], {
      error: "sortBy invalide. Valeurs possibles : createdAt, updatedAt, status, title",
    })
    .default("createdAt"),
  order: z.enum(["asc", "desc"], { error: "order doit être asc ou desc" }).default("desc"),
});

export type ListTicketsQuery = z.output<typeof listTicketsQuerySchema>;

export const updateStatusSchema = z.object({
  status: statusField,
});
