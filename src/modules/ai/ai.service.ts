import type { AiStatus } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AiProviderError, askModel, ModelAnswer } from "../../lib/openai";
import { SYSTEM_PROMPT, buildUserMessage } from "./ai.prompt";
import { aiReplySchema } from "./ai.schemas";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Ce dont l'IA a besoin d'un ticket (rien sur son auteur)
type TicketForAi = { id: number; title: string; description: string };

// Nombre d'appels à l'IA sur les dernières 24 heures, réussis ou non :
// un appel raté peut aussi coûter des tokens
export function countAiCallsLastDay() {
  return prisma.aiCall.count({
    where: { createdAt: { gte: new Date(Date.now() - ONE_DAY_MS) } },
  });
}

// Message court enregistré en cas d'échec (jamais de détail technique ni de clé)
function describeError(error: unknown): string {
  if (error instanceof AiProviderError) return error.message;
  if (error instanceof SyntaxError) return "La réponse de l'IA n'est pas du JSON";
  if (error instanceof ZodError) return "La réponse de l'IA n'a pas le bon format";
  return "Erreur inconnue";
}

// Demande à l'IA une première réponse pour un ticket, et l'enregistre.
// Renvoie le nouvel aiStatus du ticket : SKIPPED, SUCCEEDED ou FAILED.
export async function replyToTicket(ticket: TicketForAi): Promise<AiStatus> {
  // 1. Limite du jour atteinte : on n'appelle pas l'IA, un humain répondra
  if ((await countAiCallsLastDay()) >= env.AI_MAX_CALLS_PER_DAY) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { aiStatus: "SKIPPED" } });
    return "SKIPPED";
  }

  // 2. On enregistre l'appel AVANT de le faire : il compte dans la limite même s'il échoue
  const [call] = await prisma.$transaction([
    prisma.aiCall.create({ data: { ticketId: ticket.id, model: env.AI_MODEL } }),
    prisma.ticket.update({ where: { id: ticket.id }, data: { aiStatus: "PENDING" } }),
  ]);

  let answer: ModelAnswer | null = null;

  try {
    // 3. Appel à l'IA, puis vérification du JSON avec zod
    answer = await askModel(SYSTEM_PROMPT, buildUserMessage(ticket.title, ticket.description));
    const reply = aiReplySchema.parse(JSON.parse(answer.content));

    // 4. Succès : tout est enregistré d'un coup (appel, message et statut du ticket)
    await prisma.$transaction([
      prisma.aiCall.update({
        where: { id: call.id },
        data: {
          status: "SUCCEEDED",
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
          finishedAt: new Date(),
        },
      }),
      prisma.ticketMessage.create({
        data: { ticketId: ticket.id, authorType: "AI", content: reply.answer },
      }),
      prisma.ticket.update({ where: { id: ticket.id }, data: { aiStatus: "SUCCEEDED" } }),
    ]);

    return "SUCCEEDED";
  } catch (error) {
    // 5. Échec : pas de message, le ticket attend un humain. On garde les tokens s'ils sont connus.
    await prisma.$transaction([
      prisma.aiCall.update({
        where: { id: call.id },
        data: {
          status: "FAILED",
          error: describeError(error),
          inputTokens: answer?.inputTokens ?? null,
          outputTokens: answer?.outputTokens ?? null,
          finishedAt: new Date(),
        },
      }),
      prisma.ticket.update({ where: { id: ticket.id }, data: { aiStatus: "FAILED" } }),
    ]);

    return "FAILED";
  }
}

// Lance la réponse de l'IA en arrière-plan : on ne l'attend pas,
// le client reçoit son 201 tout de suite. Une erreur ici ne fait jamais planter le serveur.
export function startAiReply(ticket: TicketForAi): void {
  replyToTicket(ticket).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : "erreur inconnue";
    console.error(`[IA] Impossible de répondre au ticket ${ticket.id} : ${reason}`);
  });
}

// Au démarrage du serveur : un ticket encore en PENDING ne recevra jamais sa réponse
// (le serveur s'est arrêté pendant l'appel). On le passe en FAILED pour qu'un humain le prenne.
// Renvoie le nombre de tickets débloqués.
export async function failStuckAiReplies(): Promise<number> {
  const [, tickets] = await prisma.$transaction([
    prisma.aiCall.updateMany({
      where: { status: "PENDING" },
      data: { status: "FAILED", error: "Serveur redémarré pendant l'appel", finishedAt: new Date() },
    }),
    prisma.ticket.updateMany({ where: { aiStatus: "PENDING" }, data: { aiStatus: "FAILED" } }),
  ]);

  return tickets.count;
}