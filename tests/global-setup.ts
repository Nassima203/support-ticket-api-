import { execSync } from "node:child_process";

// Avant tous les tests : applique les migrations manquantes sur la base de test.
// Rien n'est effacé ici : chaque fichier de test vide lui-même les tables (voir resetDatabase).
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/support_tickets_test?schema=public";

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
