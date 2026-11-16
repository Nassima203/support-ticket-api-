import { Prisma, TicketStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import { pageArgs, pageResult } from "../../lib/pagination";
import { CurrentUser } from "../../types/current-user";
import { ListTicketsQuery } from "./tickets.schemas";

// Ce qu'on renvoie de l'auteur d'un ticket (jamais son mot de passe)
const authorFields = { select: { id: true, email: true, name: true } };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Un USER ne peut pas créer plus de TICKETS_PER_USER_PER_DAY tickets sur les dernières 24 heures.
// On compte dans la base (et pas en mémoire) : la limite tient même si le serveur redémarre.
// AGENT, ADMIN et SUPER_ADMIN ne sont pas limités.
async function checkDailyTicketLimit(user: CurrentUser) {
  if (user.role !== "USER") return;

  const createdLastDay = await prisma.ticket.count({
    where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - ONE_DAY_MS) } },
  });

  if (createdLastDay >= env.TICKETS_PER_USER_PER_DAY) {
    throw new HttpError(
      429,
      `Limite atteinte : ${env.TICKETS_PER_USER_PER_DAY} tickets maximum par 24 heures. Réessaie plus tard.`,
    );
  }
}

// L'auteur est la personne connectée : on ne le demande pas dans le corps
export async function createTicket(user: CurrentUser, title: string, description: string) {
  await checkDailyTicketLimit(user);

  return prisma.ticket.create({
    data: { title, description, authorId: user.id },
    include: { author: authorFields },
  });
}

// Un USER ne voit que ses propres tickets, les autres rôles voient tout
export async function listTickets(user: CurrentUser, query: ListTicketsQuery) {
  const { status, search, sortBy, order } = query;

  const where: Prisma.TicketWhereInput = {
    ...(status ? { status } : {}),
    ...(user.role === "USER" ? { authorId: user.id } : {}),
    // Recherche dans le titre ou la description, sans tenir compte des majuscules
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // La page demandée et le nombre total, lus ensemble
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      // id en second critère : l'ordre reste stable quand deux tickets ont la même valeur
      orderBy: [{ [sortBy]: order }, { id: order }],
      include: { author: authorFields },
      ...pageArgs(query),
    }),
    prisma.ticket.count({ where }),
  ]);

  return pageResult(tickets, total, query);
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
