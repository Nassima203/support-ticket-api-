import { z } from "zod";

// ?page=2&limit=20 : champs à ajouter au schéma de la query d'une liste
const pageError = "page doit être un entier positif";
const limitError = "limit doit être un entier entre 1 et 100";

export const paginationFields = {
  page: z.coerce.number({ error: pageError }).int({ error: pageError }).min(1, { error: pageError }).default(1),
  limit: z.coerce
    .number({ error: limitError })
    .int({ error: limitError })
    .min(1, { error: limitError })
    .max(100, { error: limitError })
    .default(20),
};

export type Pagination = { page: number; limit: number };

// Ce que Prisma attend pour lire une seule page
export function pageArgs({ page, limit }: Pagination) {
  return { skip: (page - 1) * limit, take: limit };
}

// Format commun de toutes les listes : les éléments de la page + de quoi naviguer
export function pageResult<T>(data: T[], total: number, { page, limit }: Pagination) {
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
