import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { PASSWORD, api, createUser, createUserAndLogin, lastEmailToken, login, resetDatabase } from "../helpers";

// Attention : la limite de 5 connexions ratées par 15 minutes compte pour tout ce fichier.
// Les tests de cette limite sont dans rate-limit.test.ts.

beforeEach(resetDatabase);

describe("POST /auth/login", () => {
  it("renvoie un access token, un refresh token et le profil, sans le mot de passe", async () => {
    const user = await createUser("AGENT");

    const res = await api().post("/auth/login").send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.user).toEqual({ id: user.id, email: user.email, name: null, role: "AGENT" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("accepte l'email avec des majuscules et des espaces", async () => {
    const user = await createUser("USER", { email: "bob@test.com" });

    const res = await api().post("/auth/login").send({ email: "  BOB@Test.com ", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("donne le même message pour un mauvais mot de passe et un email inconnu", async () => {
    const user = await createUser("USER");

    const wrongPassword = await api().post("/auth/login").send({ email: user.email, password: "mauvais" });
    const unknownEmail = await api().post("/auth/login").send({ email: "personne@test.com", password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("refuse un compte qui n'a pas encore accepté son invitation", async () => {
    const user = await createUser("USER", { invited: true });

    const res = await api().post("/auth/login").send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("répond 400 si un champ manque", async () => {
    const res = await api().post("/auth/login").send({ email: "a@test.com" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "password est obligatoire" });
  });
});

describe("GET /auth/me et le middleware authenticate", () => {
  it("renvoie le compte de la personne connectée", async () => {
    const { user, token } = await createUserAndLogin("USER");

    const res = await api().get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: user.id, email: user.email, role: "USER", isActive: true });
  });

  it("répond 401 sans jeton", async () => {
    const res = await api().get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Connexion requise" });
  });

  it("répond 401 avec un jeton invalide", async () => {
    const res = await api().get("/auth/me").set("Authorization", "Bearer pas-un-jeton");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Jeton invalide ou expiré" });
  });
});

describe("POST /auth/refresh", () => {
  it("donne de nouveaux jetons et révoque l'ancien refresh token", async () => {
    const { refreshToken } = await createUserAndLogin("USER");

    const res = await api().post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("ferme toutes les sessions si un refresh token déjà utilisé revient (vol probable)", async () => {
    const { refreshToken } = await createUserAndLogin("USER");
    const first = await api().post("/auth/refresh").send({ refreshToken });

    const reuse = await api().post("/auth/refresh").send({ refreshToken });
    const legitimate = await api().post("/auth/refresh").send({ refreshToken: first.body.refreshToken });

    expect(reuse.status).toBe(401);
    expect(legitimate.status).toBe(401);
  });

  it("refuse un refresh token inconnu", async () => {
    const res = await api().post("/auth/refresh").send({ refreshToken: "inconnu" });
    expect(res.status).toBe(401);
  });

  it("refuse un refresh token expiré", async () => {
    const { user, refreshToken } = await createUserAndLogin("USER");
    await prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await api().post("/auth/refresh").send({ refreshToken });

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("révoque la session : le refresh token ne marche plus", async () => {
    const { refreshToken } = await createUserAndLogin("USER");

    const logout = await api().post("/auth/logout").send({ refreshToken });
    const refresh = await api().post("/auth/refresh").send({ refreshToken });

    expect(logout.status).toBe(204);
    expect(refresh.status).toBe(401);
  });

  it("répond pareil pour un jeton inconnu", async () => {
    const res = await api().post("/auth/logout").send({ refreshToken: "inconnu" });
    expect(res.status).toBe(204);
  });
});

describe("Invitations", () => {
  async function inviteUser() {
    const { token } = await createUserAndLogin("ADMIN");
    await api().post("/users").set("Authorization", `Bearer ${token}`).send({ email: "new@test.com", role: "USER" });
    return lastEmailToken();
  }

  it("permet de choisir son mot de passe puis de se connecter", async () => {
    const invitationToken = await inviteUser();

    const accept = await api().post("/auth/accept-invitation").send({ token: invitationToken, password: "Nouveau123" });
    const tokens = await login("new@test.com", "Nouveau123");

    expect(accept.status).toBe(200);
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  it("ne marche qu'une seule fois", async () => {
    const invitationToken = await inviteUser();
    await api().post("/auth/accept-invitation").send({ token: invitationToken, password: "Nouveau123" });

    const again = await api().post("/auth/accept-invitation").send({ token: invitationToken, password: "Autre1234" });

    expect(again.status).toBe(400);
    expect(again.body).toEqual({ error: "Invitation invalide ou expirée" });
  });

  it("refuse une invitation expirée", async () => {
    const invitationToken = await inviteUser();
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await api().post("/auth/accept-invitation").send({ token: invitationToken, password: "Nouveau123" });

    expect(res.status).toBe(400);
  });

  it("refuse un mot de passe trop court", async () => {
    const invitationToken = await inviteUser();

    const res = await api().post("/auth/accept-invitation").send({ token: invitationToken, password: "court" });

    expect(res.status).toBe(400);
  });
});
