import { describe, expect, it } from "vitest";
import { api } from "../helpers";

describe("Gestion des erreurs", () => {
  it("répond 400 pour un corps qui n'est pas du JSON valide", async () => {
    const res = await api().post("/auth/login").set("Content-Type", "application/json").send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Le corps de la requête n'est pas un JSON valide" });
  });

  it("répond 413 pour un corps de plus de 100 ko", async () => {
    const res = await api()
      .post("/auth/login")
      .send({ email: "a@test.com", password: "x".repeat(200 * 1024) });

    expect(res.status).toBe(413);
  });

  it("répond 404 au format JSON pour une route inconnue", async () => {
    const res = await api().get("/nexiste-pas");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Route introuvable" });
  });
});
