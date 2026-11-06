import { beforeEach, describe, expect, it } from "vitest";
import { api, createUser, createUserAndLogin, resetDatabase } from "../helpers";

beforeEach(resetDatabase);

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("GET /audit-logs", () => {
  it("est réservé au SUPER_ADMIN", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const res = await api().get("/audit-logs").set(auth(admin.token));
    expect(res.status).toBe(403);
  });

  it("liste les actions, les plus récentes d'abord, avec l'auteur et la cible", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");
    const target = await createUser("USER");
    await api().patch(`/users/${target.id}/role`).set(auth(superAdmin.token)).send({ role: "AGENT" });
    await api().patch(`/users/${target.id}/status`).set(auth(superAdmin.token)).send({ isActive: false });

    const res = await api().get("/audit-logs").set(auth(superAdmin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { action: string }) => l.action)).toEqual(["USER_DEACTIVATED", "ROLE_CHANGED"]);
    expect(res.body.data[1]).toMatchObject({
      actor: { id: superAdmin.user.id, email: superAdmin.user.email, role: "SUPER_ADMIN" },
      targetUser: { id: target.id },
      details: { from: "USER", to: "AGENT" },
    });
    expect(res.body.pagination.total).toBe(2);
  });

  it("filtre par action et par compte cible", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");
    const a = await createUser("USER");
    const b = await createUser("USER");
    await api().patch(`/users/${a.id}/role`).set(auth(superAdmin.token)).send({ role: "AGENT" });
    await api().patch(`/users/${b.id}/role`).set(auth(superAdmin.token)).send({ role: "AGENT" });
    await api().patch(`/users/${b.id}/status`).set(auth(superAdmin.token)).send({ isActive: false });

    const byAction = await api().get("/audit-logs?action=ROLE_CHANGED").set(auth(superAdmin.token));
    const byTarget = await api().get(`/audit-logs?targetUserId=${b.id}`).set(auth(superAdmin.token));

    expect(byAction.body.pagination.total).toBe(2);
    expect(byTarget.body.pagination.total).toBe(2);
  });

  it("répond 400 pour un filtre invalide", async () => {
    const superAdmin = await createUserAndLogin("SUPER_ADMIN");

    expect((await api().get("/audit-logs?action=HACK").set(auth(superAdmin.token))).status).toBe(400);
    expect((await api().get("/audit-logs?targetUserId=abc").set(auth(superAdmin.token))).status).toBe(400);
  });
});
