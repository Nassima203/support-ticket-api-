import { Router, Request, Response } from "express";
import { TicketStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";

export const ticketsRouter = Router();

// Toutes les routes des tickets demandent d'être connecté
ticketsRouter.use(authenticate);

// Liste des statuts autorisés : OPEN, IN_PROGRESS, RESOLVED, CLOSED
const STATUSES = Object.values(TicketStatus);

// Ce qu'on renvoie de l'auteur d'un ticket (jamais son mot de passe)
const authorFields = { select: { id: true, email: true, name: true } };

// Transforme "12" en 12, ou renvoie null si ce n'est pas un entier positif
function parseId(value: string | string[]): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 1. Créer un ticket : POST /tickets (tous les rôles)
ticketsRouter.post("/", async (req: Request, res: Response) => {
  const { title, description } = req.body ?? {};

  if (!title || !description) {
    res.status(400).json({ error: "title et description sont obligatoires" });
    return;
  }

  // L'auteur est la personne connectée : on ne le demande plus dans le corps
  const ticket = await prisma.ticket.create({
    data: { title, description, authorId: req.user!.id },
    include: { author: authorFields },
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

  // Un USER ne voit que ses propres tickets, les autres rôles voient tout
  const onlyMine = req.user!.role === "USER";

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(onlyMine ? { authorId: req.user!.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { author: authorFields },
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

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { author: authorFields },
  });

  // Un USER qui demande le ticket de quelqu'un d'autre reçoit 404 : on ne révèle pas qu'il existe
  if (!ticket || (req.user!.role === "USER" && ticket.authorId !== req.user!.id)) {
    res.status(404).json({ error: "Ticket introuvable" });
    return;
  }

  res.json(ticket);
});

// 4. Modifier le statut : PATCH /tickets/:id/status (AGENT, ADMIN, SUPER_ADMIN)
ticketsRouter.patch(
  "/:id/status",
  authorize("AGENT", "ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response) => {
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
      include: { author: authorFields },
    });

    res.json(ticket);
  },
);
