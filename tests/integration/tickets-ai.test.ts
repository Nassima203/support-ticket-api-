import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env";
import { AiProviderError, askModel, ModelAnswer } from "../../src/lib/openai";
import { prisma } from "../../src/lib/prisma";
import { failStuckAiReplies } from "../../src/modules/ai/ai.service";
import { api, createUser, createUserAndLogin, resetDatabase } from "../helpers";

// Faux OpenAI : askModel est remplacée, aucun vrai appel n'est jamais fait
vi.mock("../../src/lib/openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/openai")>();
  return { ...actual, askModel: vi.fn() };
});

const mockedAskModel = vi.mocked(askModel);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const newTicket = { title: "Mon Wi-Fi ne marche plus", description: "Mon PC ne se connecte plus." };

// Attend que l'IA ait fini en arrière-plan
async function waitForAiStatus(ticketId: number, aiStatus: string) {
  await vi.waitFor(async () => {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.aiStatus).toBe(aiStatus);
  });
}

beforeEach(async () => {
  await resetDatabase();
  mockedAskModel.mockReset();
});

// Dans les tests, l'IA est désactivée par défaut : on la rallume seulement dans certains tests
afterEach(() => {
  env.AI_ENABLED = false;
});

describe("POST /tickets et l'IA", () => {
  it("IA désactivée : le ticket est SKIPPED et l'IA n'est jamais appelée", async () => {
    const { token } = await createUserAndLogin("USER");

    const res = await api().post("/tickets").set(auth(token)).send(newTicket);

    expect(res.status).toBe(201);
    expect(res.body.aiStatus).toBe("SKIPPED");
    expect(mockedAskModel).not.toHaveBeenCalled();
  });

  it("IA activée : répond 201 en PENDING sans attendre l'IA, puis enregistre sa réponse", async () => {
    env.AI_ENABLED = true;
    // L'IA ne répond que quand on appelle finish() : on prouve que le 201 part avant
    let finish!: (answer: ModelAnswer) => void;
    mockedAskModel.mockReturnValue(new Promise<ModelAnswer>((resolve) => (finish = resolve)));
    const { token } = await createUserAndLogin("USER");

    const res = await api().post("/tickets").set(auth(token)).send(newTicket);

    expect(res.status).toBe(201);
    expect(res.body.aiStatus).toBe("PENDING");

    finish({ content: JSON.stringify({ inScope: true, answer: "1. Redémarre ta box." }), inputTokens: 100, outputTokens: 50 });
    await waitForAiStatus(res.body.id, "SUCCEEDED");

    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: res.body.id } });
    expect(messages).toMatchObject([{ authorType: "AI", content: "1. Redémarre ta box." }]);
  });

  it("IA activée mais en panne : le ticket est créé quand même, puis passe en FAILED", async () => {
    env.AI_ENABLED = true;
    mockedAskModel.mockRejectedValue(new AiProviderError("Délai dépassé"));
    const { token } = await createUserAndLogin("USER");

    const res = await api().post("/tickets").set(auth(token)).send(newTicket);

    expect(res.status).toBe(201);
    await waitForAiStatus(res.body.id, "FAILED");
    expect(await prisma.ticketMessage.count()).toBe(0);
  });
});

describe("failStuckAiReplies", () => {
  it("passe en FAILED les tickets et appels restés en PENDING, sans toucher aux autres", async () => {
    const author = await createUser("USER");
    const stuck = await prisma.ticket.create({
      data: { title: "Bloqué", description: "x", authorId: author.id, aiStatus: "PENDING" },
    });
    const done = await prisma.ticket.create({
      data: { title: "Terminé", description: "x", authorId: author.id, aiStatus: "SUCCEEDED" },
    });
    await prisma.aiCall.create({ data: { ticketId: stuck.id, model: "test" } });

    expect(await failStuckAiReplies()).toBe(1);

    expect(await prisma.ticket.findUnique({ where: { id: stuck.id } })).toMatchObject({ aiStatus: "FAILED" });
    expect(await prisma.ticket.findUnique({ where: { id: done.id } })).toMatchObject({ aiStatus: "SUCCEEDED" });
    expect(await prisma.aiCall.findMany()).toMatchObject([
      { status: "FAILED", error: "Serveur redémarré pendant l'appel" },
    ]);
  });
});