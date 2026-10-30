import { TicketStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import { CurrentUser } from "../../types/current-user";

// Ce qu'on renvoie de l'auteur d'un ticket (jamais son mot de passe)
const authorFields = { select: { id: true, email: true, name: true } };

// L'auteur est la personne connectée : on ne le demande pas dans le corps
export function createTicket(user: CurrentUser, title: string, description: string) {
  return prisma.ticket.create({
    data: { title, description, authorId: user.id },
    include: { author: authorFields },
  });
}

// Un USER ne voit que ses propres tickets, les autres rôles voient tout
export function listTickets(user: CurrentUser, status?: TicketStatus) {
  const onlyMine = user.role === "USER";

  return prisma.ticket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(onlyMine ? { authorId: user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { author: authorFields },
  });
}

export async function getTicket(user: CurrentUser, id: number) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { author: authorFields },
  });

  // Un USER qui demande le ticket de quelqu'un d'autre reçoit 404 : on ne révèle pas qu'il existe
  if (!ticket || (user.role === "USER" && ticket.authorId !== user.id)) {
    throw new HttpError(404, "Ticket introuvable");
  }

  return ticket;
}

export async function updateTicketStatus(id: number, status: TicketStatus) {
  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Ticket introuvable");

  return prisma.ticket.update({
    where: { id },
    data: { status },
    include: { author: authorFields },
  });
}
