import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { pageArgs, pageResult } from "../../lib/pagination";
import { ListAuditLogsQuery } from "./audit.schemas";

type AuditEntry = {
  action: AuditAction;
  actorId: number | null;
  targetUserId: number | null;
  details?: Prisma.InputJsonValue;
};

// Enregistre une action sensible. On passe la transaction en cours (tx) pour que l'action
// et sa ligne d'audit soient enregistrées ensemble, ou pas du tout.
export function recordAudit(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({ data: entry });
}

// Ce qu'on renvoie des personnes liées à une ligne d'audit
const personFields = { select: { id: true, email: true, role: true } };

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
  };

  // Les plus récentes d'abord
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { actor: personFields, targetUser: personFields },
      ...pageArgs(query),
    }),
    prisma.auditLog.count({ where }),
  ]);

  return pageResult(logs, total, query);
}
