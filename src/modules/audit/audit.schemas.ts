import { z } from "zod";
import { AuditAction } from "@prisma/client";
import { paginationFields } from "../../lib/pagination";

const idError = "L'id doit être un nombre entier positif";
const idFilter = z.coerce.number({ error: idError }).int({ error: idError }).min(1, { error: idError }).optional();

// GET /audit-logs?action=ROLE_CHANGED&actorId=1&targetUserId=4&page=1&limit=20
export const listAuditLogsQuerySchema = z.object({
  action: z
    .enum(AuditAction, { error: `action invalide. Valeurs possibles : ${Object.values(AuditAction).join(", ")}` })
    .optional(),
  actorId: idFilter,
  targetUserId: idFilter,
  ...paginationFields,
});

export type ListAuditLogsQuery = z.output<typeof listAuditLogsQuerySchema>;
