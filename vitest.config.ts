import { defineConfig } from "vitest/config";

// Base de test séparée : elle est vidée par les tests, ne jamais y mettre la base de dev
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/support_tickets_test?schema=public";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET: "secret-de-test-uniquement",
      RESEND_API_KEY: "",
      // Les tests envoient beaucoup de requêtes depuis la même adresse
      RATE_LIMIT_MAX: "100000",
    },
    globalSetup: "tests/global-setup.ts",
    setupFiles: ["tests/setup.ts"],
    // Une seule base pour tous les fichiers : on les lance l'un après l'autre
    fileParallelism: false,
  },
});
