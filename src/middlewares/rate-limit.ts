import { rateLimit } from "express-rate-limit";

// 5 tentatives de connexion ratées maximum par 15 minutes et par adresse IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessaie dans 15 minutes." },
});

// 5 demandes de réinitialisation maximum par 15 minutes et par adresse IP
// (évite d'envoyer des dizaines d'emails à quelqu'un)
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de demandes. Réessaie dans 15 minutes." },
});
