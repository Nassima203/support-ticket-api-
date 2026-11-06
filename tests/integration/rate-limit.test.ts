import { beforeAll, describe, expect, it } from "vitest";
import { PASSWORD, api, createUser, resetDatabase } from "../helpers";

describe("Protection contre la force brute", () => {
  beforeAll(resetDatabase);

  it("bloque la connexion après 5 échecs, même avec le bon mot de passe ensuite", async () => {
    const user = await createUser("USER");

    for (let i = 0; i < 5; i++) {
      const res = await api().post("/auth/login").send({ email: user.email, password: "mauvais" });
      expect(res.status).toBe(401);
    }
    const blocked = await api().post("/auth/login").send({ email: user.email, password: PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Trop de tentatives de connexion. Réessaie dans 15 minutes." });
  });

  it("applique une limite générale sur toute l'API (en-têtes RateLimit)", async () => {
    const res = await api().get("/nexiste-pas");

    expect(res.headers["ratelimit-policy"]).toBeDefined();
  });
});
