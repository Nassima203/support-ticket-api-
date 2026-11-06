import { Request, Response } from "express";
import { parseId } from "../../lib/parse-id";
import { validate } from "../../lib/validate";
import * as ticketsService from "./tickets.service";
import { createTicketSchema, listTicketsQuerySchema, updateStatusSchema } from "./tickets.schemas";

// POST /tickets
export async function create(req: Request, res: Response) {
  const { title, description } = validate(createTicketSchema, req.body ?? {});
  const ticket = await ticketsService.createTicket(req.user!, title, description);
  res.status(201).json(ticket);
}

// GET /tickets (filtres, pagination et tri dans la query)
export async function list(req: Request, res: Response) {
  const query = validate(listTicketsQuerySchema, req.query);
  res.json(await ticketsService.listTickets(req.user!, query));
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
  const { status } = validate(updateStatusSchema, req.body ?? {});
  const ticket = await ticketsService.updateTicketStatus(id, status);
  res.json(ticket);
}
