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
      // Les tests n'appellent JAMAIS la vraie IA : coupée et sans clé.
      // Ces valeurs passent avant celles de ton .env (dotenv ne remplace pas une variable déjà définie).
      AI_ENABLED: "false",
      AI_API_KEY: "",
      AI_MODEL: "modele-de-test",
      AI_BASE_URL: "",
      // Les tests de la limite par jour supposent 10 tickets, quelle que soit la valeur du .env
      TICKETS_PER_USER_PER_DAY: "10",
      AI_MAX_CALLS_PER_DAY: "100",
    },
    globalSetup: "tests/global-setup.ts",
    setupFiles: ["tests/setup.ts"],
    // Une seule base pour tous les fichiers : on les lance l'un après l'autre
    fileParallelism: false,
  },
});
