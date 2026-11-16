import "dotenv/config";
import { z } from "zod";

// Lit une variable obligatoire du .env, ou arrête le serveur avec un message clair
// (le message donne le nom de la variable, jamais sa valeur)
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

// Un nombre entier lu dans le .env, entre 1 et max.
// Si la variable est absente, on prend la valeur par défaut.
function positiveInt(defaultValue: number, max: number) {
  return z.coerce
    .number({ error: "doit être un nombre" })
    .int({ error: "doit être un nombre entier" })
    .min(1, { error: "doit valoir au moins 1" })
    .max(max, { error: `doit valoir au maximum ${max}` })
    .default(defaultValue);
}

// Les réglages chiffrés de l'IA et des limites.
// Le max évite qu'une faute de frappe (un zéro de trop) vide le budget.
const aiLimitsSchema = z.object({
  // On abandonne l'appel à l'IA au bout de 20 secondes (2 minutes maximum)
  AI_TIMEOUT_MS: positiveInt(20000, 120000),
  // Longueur max de la réponse (raisonnement du modèle compris) : protège le budget
  AI_MAX_OUTPUT_TOKENS: positiveInt(1000, 4000),
  // Nombre maximum d'appels à l'IA par jour, pour toute l'API : le vrai plafond du budget
  AI_MAX_CALLS_PER_DAY: positiveInt(100, 1000),
  // Tickets maximum par compte USER sur les dernières 24 heures (les autres rôles ne sont pas limités)
  TICKETS_PER_USER_PER_DAY: positiveInt(10, 100),
});

export type AiLimits = z.infer<typeof aiLimitsSchema>;

// Vérifie les réglages chiffrés. S'il y a un problème, arrête le serveur
// en listant toutes les variables fausses d'un coup.
// Exportée pour pouvoir la tester avec d'autres valeurs que celles du .env.
export function readAiLimits(source: NodeJS.ProcessEnv): AiLimits {
  // Une variable vide (par exemple "AI_TIMEOUT_MS=") compte comme absente : valeur par défaut
  const input = Object.fromEntries(
    Object.keys(aiLimitsSchema.shape).map((name) => [name, source[name] || undefined]),
  );

  const result = aiLimitsSchema.safeParse(input);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `- ${issue.path.join(".")} ${issue.message}`);
    throw new Error(`Variables d'environnement invalides :\n${problems.join("\n")}`);
  }

  return result.data;
}

// L'IA n'est activée que si AI_ENABLED vaut exactement "true".
// Absente ou toute autre valeur : IA coupée (tests, CI, ou pas encore de clé).
const AI_ENABLED = process.env.AI_ENABLED === "true";

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: required("DATABASE_URL"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_DAYS: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  // Nombre maximum de requêtes par 15 minutes et par adresse IP, sur toute l'API
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 300,

  // --- IA : première réponse automatique aux tickets ---
  AI_ENABLED,
  // Ce qui était écrit dans AI_ENABLED, pour prévenir au démarrage en cas de faute ("TRUE", "oui"…)
  AI_ENABLED_RAW: process.env.AI_ENABLED ?? "",
  // Obligatoires seulement quand l'IA est activée
  AI_API_KEY: AI_ENABLED ? required("AI_API_KEY") : "",
  AI_MODEL: AI_ENABLED ? required("AI_MODEL") : "",
  // Vide = adresse officielle d'OpenAI. Sinon, un service compatible (proxy de l'école...)
  AI_BASE_URL: process.env.AI_BASE_URL || undefined,
  // AI_TIMEOUT_MS, AI_MAX_OUTPUT_TOKENS, AI_MAX_CALLS_PER_DAY, TICKETS_PER_USER_PER_DAY
  ...readAiLimits(process.env),
};