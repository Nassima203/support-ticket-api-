import { Router, Request, Response } from "express";
import { TicketStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export const ticketsRouter = Router();

// Liste des statuts autorisés : OPEN, IN_PROGRESS, RESOLVED, CLOSED
const STATUSES = Object.values(TicketStatus);

// Transforme "12" en 12, ou renvoie null si ce n'est pas un entier positif
function parseId(value: string | string[]): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 1. Créer un ticket : POST /tickets
ticketsRouter.post("/", async (req: Request, res: Response) => {
  const { title, description, authorEmail } = req.body ?? {};

  if (!title || !description || !authorEmail) {
    res.status(400).json({ error: "title, description et authorEmail sont obligatoires" });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: { title, description, authorEmail },
  });

  res.status(201).json(ticket);
});

// 2. Lister les tickets : GET /tickets (filtre optionnel ?status=OPEN)
ticketsRouter.get("/", async (req: Request, res: Response) => {
  const status = req.query.status as TicketStatus | undefined;

  if (status && !STATUSES.includes(status)) {
    res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${STATUSES.join(", ")}` });
    return;
  }

  const tickets = await prisma.ticket.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  res.json(tickets);
});

// 3. Récupérer un ticket : GET /tickets/:id
ticketsRouter.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  if (id === null) {
    res.status(400).json({ error: "L'id doit être un nombre entier positif" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    res.status(404).json({ error: "Ticket introuvable" });
    return;
  }

  res.json(ticket);
});

// 4. Modifier le statut : PATCH /tickets/:id/status
ticketsRouter.patch("/:id/status", async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const { status } = req.body ?? {};

  if (id === null) {
    res.status(400).json({ error: "L'id doit être un nombre entier positif" });
    return;
  }

  if (!STATUSES.includes(status)) {
    res.status(400).json({ error: `Statut invalide. Valeurs possibles : ${STATUSES.join(", ")}` });
    return;
  }

  const existing = await prisma.ticket.findUnique({ where: { id } });

  if (!existing) {
    res.status(404).json({ error: "Ticket introuvable" });
    return;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { status },
  });

  res.json(ticket);
});
