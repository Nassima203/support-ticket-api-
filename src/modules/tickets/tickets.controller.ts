import { Request, Response } from "express";
import { TicketStatus } from "@prisma/client";
import { HttpError } from "../../lib/http-error";
import { parseId } from "../../lib/parse-id";
import * as ticketsService from "./tickets.service";

// Liste des statuts autorisés : OPEN, IN_PROGRESS, RESOLVED, CLOSED
const STATUSES = Object.values(TicketStatus);
const invalidStatus = `Statut invalide. Valeurs possibles : ${STATUSES.join(", ")}`;

function isStatus(value: unknown): value is TicketStatus {
  return STATUSES.includes(value as TicketStatus);
}

// POST /tickets
export async function create(req: Request, res: Response) {
  const { title, description } = req.body ?? {};

  if (!title || !description) {
    throw new HttpError(400, "title et description sont obligatoires");
  }

  const ticket = await ticketsService.createTicket(req.user!, title, description);
  res.status(201).json(ticket);
}

// GET /tickets (filtre optionnel ?status=OPEN)
export async function list(req: Request, res: Response) {
  const { status } = req.query;

  if (status !== undefined && !isStatus(status)) {
    throw new HttpError(400, invalidStatus);
  }

  const tickets = await ticketsService.listTickets(req.user!, status);
  res.json(tickets);
}

// GET /tickets/:id
export async function getOne(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const ticket = await ticketsService.getTicket(req.user!, id);
  res.json(ticket);
}

// PATCH /tickets/:id/status
export async function updateStatus(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const { status } = req.body ?? {};

  if (!isStatus(status)) throw new HttpError(400, invalidStatus);

  const ticket = await ticketsService.updateTicketStatus(id, status);
  res.json(ticket);
}
