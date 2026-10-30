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
