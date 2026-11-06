import { Request, Response } from "express";
import { validate } from "../../lib/validate";
import * as auditService from "./audit.service";
import { listAuditLogsQuerySchema } from "./audit.schemas";

// GET /audit-logs
export async function list(req: Request, res: Response) {
  const query = validate(listAuditLogsQuerySchema, req.query);
  res.json(await auditService.listAuditLogs(query));
}
