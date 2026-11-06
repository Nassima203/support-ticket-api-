import { describe, expect, it } from "vitest";
import { openapiSpec } from "../../src/docs/openapi";
import { api } from "../helpers";

// Toutes les routes documentées, au format "METHODE /chemin"
const documentedRoutes = Object.entries(openapiSpec.paths as Record<string, Record<string, unknown>>).flatMap(
  ([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
);

describe("Documentation OpenAPI", () => {
  it("sert le contrat sur /openapi.json et Swagger UI sur /docs", async () => {
    const spec = await api().get("/openapi.json");
    const ui = await api().get("/docs/");

    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.0.3");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("swagger-ui");
  });

  it("documente les 17 routes de l'API", () => {
    expect(documentedRoutes).toHaveLength(17);
  });

  // Une route documentée qui n'existe pas dans le code répondrait "Route introuvable"
  it.each(documentedRoutes)("%s existe dans l'API", async (route) => {
    const [method, path] = route.split(" ");
    const url = path.replace("{id}", "1");

    const res = await api()[method.toLowerCase() as "get" | "post" | "patch"](url).send({});

    expect(res.body.error).not.toBe("Route introuvable");
  });
});
