import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { api, createUser, createUserAndLogin, lastEmailToken, login, resetDatabase, sentEmails } from "../helpers";

// Attention : forgot-password est limité à 5 demandes par 15 minutes pour tout ce fichier.

beforeEach(resetDatabase);

const SAME_ANSWER = { message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" };

describe("POST /auth/forgot-password", () => {
  it("répond pareil pour un email inconnu, sans envoyer d'email", async () => {
    const res = await api().post("/auth/forgot-password").send({ email: "personne@test.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(SAME_ANSWER);
    expect(sentEmails()).toHaveLength(0);
  });

  it("n'envoie rien à un compte désactivé", async () => {
    const user = await createUser("USER", { isActive: false });

    const res = await api().post("/auth/forgot-password").send({ email: user.email });

    expect(res.body).toEqual(SAME_ANSWER);
    expect(sentEmails()).toHaveLength(0);
  });
});

describe("POST /auth/reset-password", () => {
  it("change le mot de passe, ferme les sessions, ne sert qu'une fois et s'enregistre dans l'audit", async () => {
    const { user, refreshToken } = await createUserAndLogin("USER");
    await api().post("/auth/forgot-password").send({ email: user.email });
    const resetToken = lastEmailToken();

    const reset = await api().post("/auth/reset-password").send({ token: resetToken, password: "NouveauMdp456" });
    const reuse = await api().post("/auth/reset-password").send({ token: resetToken, password: "EncoreUn789" });
    const oldSession = await api().post("/auth/refresh").send({ refreshToken });
    const tokens = await login(user.email, "NouveauMdp456");

    expect(reset.status).toBe(200);
    expect(reuse.status).toBe(400);
    expect(oldSession.status).toBe(401);
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(await prisma.auditLog.findFirst({ where: { action: "PASSWORD_RESET" } })).toMatchObject({
      actorId: user.id,
      targetUserId: user.id,
    });
  });

  it("une nouvelle demande rend l'ancien lien inutilisable", async () => {
    const user = await createUser("USER");
    await api().post("/auth/forgot-password").send({ email: user.email });
    const first = lastEmailToken();
    await api().post("/auth/forgot-password").send({ email: user.email });

    const res = await api().post("/auth/reset-password").send({ token: first, password: "NouveauMdp456" });

    expect(res.status).toBe(400);
  });

  it("refuse un lien expiré et un mot de passe trop court", async () => {
    const user = await createUser("USER");
    const { generateToken, hashToken } = await import("../../src/lib/tokens");
    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() - 1000) },
    });

    const expired = await api().post("/auth/reset-password").send({ token, password: "NouveauMdp456" });
    const tooShort = await api().post("/auth/reset-password").send({ token, password: "court" });

    expect(expired.status).toBe(400);
    expect(expired.body).toEqual({ error: "Lien invalide ou expiré" });
    expect(tooShort.status).toBe(400);
  });
});
