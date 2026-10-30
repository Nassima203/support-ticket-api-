import express, { NextFunction, Request, Response } from "express";
import { PrismaClient, TicketStatus } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3000;

// Permet de lire le JSON envoyé dans le corps des requêtes
app.use(express.json());

// Liste des statuts autorisés : OPEN, IN_PROGRESS, RESOLVED, CLOSED
const STATUSES = Object.values(TicketStatus);

// Transforme "12" en 12, ou renvoie null si ce n'est pas un entier positif
function parseId(value: string | string[]): number | null {
  if (Array.isArray(value)) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 1. Créer un ticket
app.post("/tickets", async (req: Request, res: Response) => {
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

// 2. Lister les tickets (filtre optionnel : /tickets?status=OPEN)
app.get("/tickets", async (req: Request, res: Response) => {
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

// 3. Récupérer un ticket par son ID
app.get("/tickets/:id", async (req: Request, res: Response) => {
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

// 4. Modifier le statut d'un ticket
app.patch("/tickets/:id/status", async (req: Request, res: Response) => {
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

// Filet de sécurité : toute erreur imprévue renvoie un 500 propre
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

app.listen(PORT, () => {
  console.log(`API démarrée sur http://localhost:${PORT}`);
});
