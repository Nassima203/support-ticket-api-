import { z } from "zod";
import { TicketStatus } from "@prisma/client";

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

export const listTicketsQuerySchema = z.object({
  status: statusField.optional(),
});

export const updateStatusSchema = z.object({
  status: statusField,
});
