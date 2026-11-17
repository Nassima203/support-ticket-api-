import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env";
import { AiProviderError, askModel } from "../../src/lib/openai";
import { prisma } from "../../src/lib/prisma";
import { SYSTEM_PROMPT } from "../../src/modules/ai/ai.prompt";
import { replyToTicket } from "../../src/modules/ai/ai.service";
import { createUser, resetDatabase } from "../helpers";

// Faux OpenAI : askModel est remplacée, aucun vrai appel n'est jamais fait
vi.mock("../../src/lib/openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/openai")>();
  return { ...actual, askModel: vi.fn() };
});

const mockedAskModel = vi.mocked(askModel);

// Ce que le faux OpenAI renvoie : un objet est transformé en texte JSON
function modelAnswer(content: unknown) {
  return {
    content: typeof content === "string" ? content : JSON.stringify(content),
    inputTokens: 120,
    outputTokens: 80,
  };
}

async function createTicket() {
  const author = await createUser("USER");
  const ticket = await prisma.ticket.create({
    data: {
      title: "Mon Wi-Fi ne marche plus",
      description: "Mon PC ne se connecte plus depuis ce matin.",
      authorId: author.id,
    },
  });
  return { author, ticket };
}

const ONE_HOUR_MS = 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
  mockedAskModel.mockReset();
});

describe("replyToTicket", () => {
  it("enregistre la réponse de l'IA pour une question tech", async () => {
    const { ticket } = await createTicket();
    mockedAskModel.mockResolvedValue(modelAnswer({ inScope: true, answer: "1. Redémarre ta box." }));

    expect(await replyToTicket(ticket)).toBe("SUCCEEDED");

    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id } });
    expect(messages).toMatchObject([{ authorType: "AI", authorId: null, content: "1. Redémarre ta box." }]);

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated).toMatchObject({ aiStatus: "SUCCEEDED", status: "OPEN" });

    const calls = await prisma.aiCall.findMany();
    expect(calls).toMatchObject([
      { ticketId: ticket.id, status: "SUCCEEDED", model: env.AI_MODEL, inputTokens: 120, outputTokens: 80, error: null },
    ]);
  });

  it("enregistre le refus poli de l'IA pour une question hors sujet", async () => {
    const { ticket } = await createTicket();
    const refusal = "Je réponds uniquement aux questions techniques et informatiques.";
    mockedAskModel.mockResolvedValue(modelAnswer({ inScope: false, answer: refusal }));

    expect(await replyToTicket(ticket)).toBe("SUCCEEDED");

    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id } });
    expect(messages).toMatchObject([{ authorType: "AI", content: refusal }]);

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.status).toBe("OPEN");
  });

  it("envoie le prompt système, le titre et la description, mais rien sur l'auteur", async () => {
    const { author, ticket } = await createTicket();
    mockedAskModel.mockResolvedValue(modelAnswer({ inScope: true, answer: "Ok" }));

    await replyToTicket(ticket);

    expect(mockedAskModel).toHaveBeenCalledTimes(1);
    const [systemPrompt, userMessage] = mockedAskModel.mock.calls[0];
    expect(systemPrompt).toBe(SYSTEM_PROMPT);
    expect(userMessage).toContain(ticket.title);
    expect(userMessage).toContain(ticket.description);
    expect(userMessage).not.toContain(author.email);
  });

  it("passe en FAILED si la réponse n'est pas du JSON, en gardant les tokens", async () => {
    const { ticket } = await createTicket();
    mockedAskModel.mockResolvedValue(modelAnswer("Voici ma réponse sans JSON"));

    expect(await replyToTicket(ticket)).toBe("FAILED");

    expect(await prisma.ticketMessage.count()).toBe(0);
    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.aiStatus).toBe("FAILED");
    expect(await prisma.aiCall.findMany()).toMatchObject([
      { status: "FAILED", error: "La réponse de l'IA n'est pas du JSON", inputTokens: 120, outputTokens: 80 },
    ]);
  });

  it("passe en FAILED si le JSON n'a pas le bon format", async () => {
    const { ticket } = await createTicket();
    mockedAskModel.mockResolvedValue(modelAnswer({ inScope: true }));

    expect(await replyToTicket(ticket)).toBe("FAILED");

    expect(await prisma.ticketMessage.count()).toBe(0);
    expect(await prisma.aiCall.findMany()).toMatchObject([
      { status: "FAILED", error: "La réponse de l'IA n'a pas le bon format" },
    ]);
  });

  it("passe en FAILED si OpenAI ne répond pas", async () => {
    const { ticket } = await createTicket();
    mockedAskModel.mockRejectedValue(new AiProviderError("Délai dépassé"));

    expect(await replyToTicket(ticket)).toBe("FAILED");

    expect(await prisma.aiCall.findMany()).toMatchObject([
      { status: "FAILED", error: "Délai dépassé", inputTokens: null, outputTokens: null },
    ]);
  });

  it("n'appelle pas l'IA quand la limite du jour est atteinte (les échecs comptent aussi)", async () => {
    const { ticket } = await createTicket();
    await prisma.aiCall.createMany({
      data: Array.from({ length: env.AI_MAX_CALLS_PER_DAY }, () => ({ model: "ancien", status: "FAILED" as const })),
    });

    expect(await replyToTicket(ticket)).toBe("SKIPPED");

    expect(mockedAskModel).not.toHaveBeenCalled();
    expect(await prisma.aiCall.count()).toBe(env.AI_MAX_CALLS_PER_DAY);
    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.aiStatus).toBe("SKIPPED");
  });

  it("ne compte pas les appels de plus de 24 heures", async () => {
    const { ticket } = await createTicket();
    const yesterday = new Date(Date.now() - 25 * ONE_HOUR_MS);
    await prisma.aiCall.createMany({
      data: Array.from({ length: env.AI_MAX_CALLS_PER_DAY }, () => ({ model: "ancien", createdAt: yesterday })),
    });
    mockedAskModel.mockResolvedValue(modelAnswer({ inScope: true, answer: "Ok" }));

    expect(await replyToTicket(ticket)).toBe("SUCCEEDED");
  });
});