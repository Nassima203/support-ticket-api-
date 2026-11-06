import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { api, createUserAndLogin, resetDatabase } from "../helpers";

beforeEach(resetDatabase);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("POST /tickets", () => {
  it("crée un ticket OPEN dont l'auteur est la personne connectée", async () => {
    const { user, token } = await createUserAndLogin("USER");

    const res = await api()
      .post("/tickets")
      .set(auth(token))
      .send({ title: "  Impossible de me connecter ", description: "Erreur 500", authorId: 999 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Impossible de me connecter", status: "OPEN", authorId: user.id });
    expect(res.body.author).toEqual({ id: user.id, email: user.email, name: null });
  });

  it("répond 401 sans connexion", async () => {
    const res = await api().post("/tickets").send({ title: "a", description: "b" });
    expect(res.status).toBe(401);
  });

  it.each([
    [{ description: "x" }, "title et description sont obligatoires"],
    [{ title: 123, description: "x" }, "title et description sont obligatoires"],
    [{ title: "a".repeat(151), description: "x" }, "title ne doit pas dépasser 150 caractères"],
  ])("répond 400 pour %j", async (body, message) => {
    const { token } = await createUserAndLogin("USER");

    const res = await api().post("/tickets").set(auth(token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: message });
  });
});

describe("GET /tickets", () => {
  async function seed() {
    const alice = await createUserAndLogin("USER");
    const bob = await createUserAndLogin("USER");
    const agent = await createUserAndLogin("AGENT");
    await prisma.ticket.createMany({
      data: [
        { title: "Alpha imprimante", description: "papier coincé", authorId: alice.user.id },
        { title: "Bravo écran", description: "écran noir", authorId: alice.user.id, status: "RESOLVED" },
        { title: "Charlie réseau", description: "pas de connexion", authorId: bob.user.id },
      ],
    });
    return { alice, bob, agent };
  }

  it("un USER ne voit que ses propres tickets", async () => {
    const { alice } = await seed();

    const res = await api().get("/tickets").set(auth(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t: { authorId: number }) => t.authorId === alice.user.id)).toBe(true);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("un AGENT voit tous les tickets", async () => {
    const { agent } = await seed();

    const res = await api().get("/tickets").set(auth(agent.token));

    expect(res.body.pagination.total).toBe(3);
  });

  it("filtre par statut", async () => {
    const { agent } = await seed();

    const res = await api().get("/tickets?status=RESOLVED").set(auth(agent.token));

    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(["Bravo écran"]);
  });

  it("cherche dans le titre et la description, sans tenir compte des majuscules", async () => {
    const { agent } = await seed();

    const res = await api().get("/tickets?search=CONNEXION").set(auth(agent.token));

    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(["Charlie réseau"]);
  });

  it("trie et découpe en pages", async () => {
    const { agent } = await seed();

    const page1 = await api().get("/tickets?sortBy=title&order=asc&limit=2&page=1").set(auth(agent.token));
    const page2 = await api().get("/tickets?sortBy=title&order=asc&limit=2&page=2").set(auth(agent.token));

    expect(page1.body.data.map((t: { title: string }) => t.title)).toEqual(["Alpha imprimante", "Bravo écran"]);
    expect(page2.body.data.map((t: { title: string }) => t.title)).toEqual(["Charlie réseau"]);
    expect(page2.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it.each(["status=NOPE", "limit=0", "limit=500", "page=abc", "sortBy=authorId", "order=random"])(
    "répond 400 pour ?%s",
    async (query) => {
      const { token } = await createUserAndLogin("AGENT");
      const res = await api().get(`/tickets?${query}`).set(auth(token));
      expect(res.status).toBe(400);
    },
  );
});

describe("GET /tickets/:id", () => {
  it("un USER voit son ticket mais reçoit 404 pour celui d'un autre", async () => {
    const alice = await createUserAndLogin("USER");
    const bob = await createUserAndLogin("USER");
    const ticket = await prisma.ticket.create({ data: { title: "t", description: "d", authorId: bob.user.id } });

    const own = await api().get(`/tickets/${ticket.id}`).set(auth(bob.token));
    const other = await api().get(`/tickets/${ticket.id}`).set(auth(alice.token));

    expect(own.status).toBe(200);
    expect(other.status).toBe(404);
    expect(other.body).toEqual({ error: "Ticket introuvable" });
  });

  it("un AGENT voit n'importe quel ticket", async () => {
    const bob = await createUserAndLogin("USER");
    const agent = await createUserAndLogin("AGENT");
    const ticket = await prisma.ticket.create({ data: { title: "t", description: "d", authorId: bob.user.id } });

    const res = await api().get(`/tickets/${ticket.id}`).set(auth(agent.token));

    expect(res.status).toBe(200);
  });

  it("répond 400 pour un id invalide et 404 pour un ticket inexistant", async () => {
    const { token } = await createUserAndLogin("AGENT");

    expect((await api().get("/tickets/abc").set(auth(token))).status).toBe(400);
    expect((await api().get("/tickets/9999").set(auth(token))).status).toBe(404);
  });
});

describe("PATCH /tickets/:id/status", () => {
  it("un USER ne peut pas changer le statut, même de son propre ticket", async () => {
    const { user, token } = await createUserAndLogin("USER");
    const ticket = await prisma.ticket.create({ data: { title: "t", description: "d", authorId: user.id } });

    const res = await api().patch(`/tickets/${ticket.id}/status`).set(auth(token)).send({ status: "CLOSED" });

    expect(res.status).toBe(403);
  });

  it.each(["AGENT", "ADMIN", "SUPER_ADMIN"] as const)("un %s peut changer le statut", async (role) => {
    const author = await createUserAndLogin("USER");
    const staff = await createUserAndLogin(role);
    const ticket = await prisma.ticket.create({ data: { title: "t", description: "d", authorId: author.user.id } });

    const res = await api().patch(`/tickets/${ticket.id}/status`).set(auth(staff.token)).send({ status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("répond 400 pour un statut invalide et 404 pour un ticket inexistant", async () => {
    const { token } = await createUserAndLogin("AGENT");

    const invalid = await api().patch("/tickets/1/status").set(auth(token)).send({ status: "DONE" });
    const missing = await api().patch("/tickets/9999/status").set(auth(token)).send({ status: "OPEN" });

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
