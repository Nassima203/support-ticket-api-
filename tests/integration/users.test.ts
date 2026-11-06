import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { PASSWORD, api, createUser, createUserAndLogin, lastEmailToken, login, resetDatabase, sentEmails } from "../helpers";

beforeEach(resetDatabase);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Accès aux routes /users", () => {
  it.each(["USER", "AGENT"] as const)("un %s reçoit 403", async (role) => {
    const { token } = await createUserAndLogin(role);
    const res = await api().get("/users").set(auth(token));
    expect(res.status).toBe(403);
  });
});

describe("POST /users", () => {
  it("crée un compte sans mot de passe, envoie l'invitation et l'enregistre dans l'audit", async () => {
    const admin = await createUserAndLogin("ADMIN");

    const res = await api().post("/users").set(auth(admin.token)).send({ email: " New@Test.com ", name: "Nina", role: "AGENT" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "new@test.com", name: "Nina", role: "AGENT", isActive: true });
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(sentEmails().map((e) => e.to)).toEqual(["new@test.com"]);

    const log = await prisma.auditLog.findFirstOrThrow();
    expect(log).toMatchObject({ action: "USER_CREATED", actorId: admin.user.id, targetUserId: res.body.id });
  });

  it("un ADMIN ne peut pas créer un ADMIN, un SUPER_ADMIN peut", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");

    const byAdmin = await api().post("/users").set(auth(admin.token)).send({ email: "a@test.com", role: "ADMIN" });
    const bySuper = await api().post("/users").set(auth(superAdmin.token)).send({ email: "a@test.com", role: "ADMIN" });

    expect(byAdmin.status).toBe(403);
    expect(bySuper.status).toBe(201);
  });

  it("répond 409 si l'email existe déjà, même écrit autrement", async () => {
    const admin = await createUserAndLogin("ADMIN");
    await createUser("USER", { email: "taken@test.com" });

    const res = await api().post("/users").set(auth(admin.token)).send({ email: "TAKEN@test.com", role: "USER" });

    expect(res.status).toBe(409);
  });

  it.each([
    { email: "pas-un-email", role: "USER" },
    { email: "a@test.com", role: "SUPER_ADMIN" },
    { email: "a@test.com", role: "USER", name: 42 },
  ])("répond 400 pour %j", async (body) => {
    const admin = await createUserAndLogin("ADMIN");
    const res = await api().post("/users").set(auth(admin.token)).send(body);
    expect(res.status).toBe(400);
  });
});

describe("GET /users", () => {
  it("liste les comptes avec invitationPending, filtre par rôle et découpe en pages", async () => {
    const admin = await createUserAndLogin("ADMIN");
    await createUser("AGENT");
    await createUser("AGENT", { invited: true });
    await createUser("USER");

    const agents = await api().get("/users?role=AGENT").set(auth(admin.token));
    const firstPage = await api().get("/users?limit=2").set(auth(admin.token));

    expect(agents.body.data.map((u: { invitationPending: boolean }) => u.invitationPending)).toEqual([false, true]);
    expect(agents.body.data[0]).not.toHaveProperty("passwordHash");
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
  });

  it("filtre les comptes désactivés", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const off = await createUser("USER", { isActive: false });

    const res = await api().get("/users?isActive=false").set(auth(admin.token));

    expect(res.body.data.map((u: { id: number }) => u.id)).toEqual([off.id]);
  });
});

describe("POST /users/:id/resend-invitation", () => {
  it("envoie un nouveau lien et rend l'ancien inutilisable", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const created = await api().post("/users").set(auth(admin.token)).send({ email: "new@test.com", role: "USER" });
    const oldToken = lastEmailToken();

    const resend = await api().post(`/users/${created.body.id}/resend-invitation`).set(auth(admin.token));
    const newToken = lastEmailToken();
    const withOld = await api().post("/auth/accept-invitation").send({ token: oldToken, password: "Nouveau123" });
    const withNew = await api().post("/auth/accept-invitation").send({ token: newToken, password: "Nouveau123" });

    expect(resend.status).toBe(200);
    expect(withOld.status).toBe(400);
    expect(withNew.status).toBe(200);
  });

  it("répond 400 si l'invitation a déjà été acceptée", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const user = await createUser("USER");

    const res = await api().post(`/users/${user.id}/resend-invitation`).set(auth(admin.token));

    expect(res.status).toBe(400);
  });
});

describe("PATCH /users/:id/status", () => {
  it("désactive un compte : accès coupé tout de suite, sessions fermées, audit enregistré", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const target = await createUserAndLogin("USER");

    const res = await api().patch(`/users/${target.user.id}/status`).set(auth(admin.token)).send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect((await api().get("/tickets").set(auth(target.token))).status).toBe(401);
    expect((await api().post("/auth/refresh").send({ refreshToken: target.refreshToken })).status).toBe(401);
    expect((await api().post("/auth/login").send({ email: target.user.email, password: PASSWORD })).status).toBe(401);
    expect(await prisma.auditLog.findFirst({ where: { action: "USER_DEACTIVATED" } })).toMatchObject({
      actorId: admin.user.id,
      targetUserId: target.user.id,
    });
  });

  it("réactive un compte : la personne peut se reconnecter", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const target = await createUser("USER", { isActive: false });

    const res = await api().patch(`/users/${target.id}/status`).set(auth(admin.token)).send({ isActive: true });
    const tokens = await login(target.email);

    expect(res.status).toBe(200);
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(await prisma.auditLog.count({ where: { action: "USER_REACTIVATED" } })).toBe(1);
  });

  it("n'enregistre rien si le compte est déjà dans l'état demandé", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const target = await createUser("USER");

    const res = await api().patch(`/users/${target.id}/status`).set(auth(admin.token)).send({ isActive: true });

    expect(res.status).toBe(200);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("personne ne peut modifier son propre compte", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");

    const res = await api().patch(`/users/${superAdmin.user.id}/status`).set(auth(superAdmin.token)).send({ isActive: false });

    expect(res.status).toBe(400);
  });

  it("un ADMIN ne peut toucher ni un autre ADMIN ni le SUPER_ADMIN", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const otherAdmin = await createUser("ADMIN");
    const superAdmin = await createUser("SUPER_ADMIN");

    const onAdmin = await api().patch(`/users/${otherAdmin.id}/status`).set(auth(admin.token)).send({ isActive: false });
    const onSuper = await api().patch(`/users/${superAdmin.id}/status`).set(auth(admin.token)).send({ isActive: false });

    expect(onAdmin.status).toBe(403);
    expect(onSuper.status).toBe(403);
  });

  it("répond 400 si isActive n'est pas un booléen et 404 si le compte n'existe pas", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const target = await createUser("USER");

    const invalid = await api().patch(`/users/${target.id}/status`).set(auth(admin.token)).send({ isActive: "non" });
    const missing = await api().patch("/users/9999/status").set(auth(admin.token)).send({ isActive: false });

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /users/:id/role", () => {
  it("change le rôle et enregistre l'ancien et le nouveau dans l'audit", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");
    const target = await createUser("USER");

    const res = await api().patch(`/users/${target.id}/role`).set(auth(superAdmin.token)).send({ role: "AGENT" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("AGENT");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "ROLE_CHANGED" } });
    expect(log.details).toEqual({ from: "USER", to: "AGENT" });
  });

  it("prend effet tout de suite, même avec un jeton déjà émis", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const agent = await createUserAndLogin("AGENT");
    const ticket = await prisma.ticket.create({ data: { title: "t", description: "d", authorId: agent.user.id } });

    await api().patch(`/users/${agent.user.id}/role`).set(auth(admin.token)).send({ role: "USER" });
    const res = await api().patch(`/tickets/${ticket.id}/status`).set(auth(agent.token)).send({ status: "CLOSED" });

    expect(res.status).toBe(403);
  });

  it("un ADMIN ne peut pas donner le rôle ADMIN", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const target = await createUser("AGENT");

    const res = await api().patch(`/users/${target.id}/role`).set(auth(admin.token)).send({ role: "ADMIN" });

    expect(res.status).toBe(403);
  });

  it("personne ne peut recevoir le rôle SUPER_ADMIN par l'API", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");
    const target = await createUser("ADMIN");

    const res = await api().patch(`/users/${target.id}/role`).set(auth(superAdmin.token)).send({ role: "SUPER_ADMIN" });

    expect(res.status).toBe(400);
  });
});
