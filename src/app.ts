import express from "express";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./docs/openapi";
import { authRouter } from "./modules/auth/auth.routes";
import { ticketsRouter } from "./modules/tickets/tickets.routes";
import { usersRouter } from "./modules/users/users.routes";
import { auditRouter } from "./modules/audit/audit.routes";
import { errorHandler, notFound } from "./middlewares/errors";
import { apiLimiter } from "./middlewares/rate-limit";

export const app = express();

// Limite le nombre de requêtes par adresse IP, avant tout le reste
app.use(apiLimiter);

// Permet de lire le JSON envoyé dans le corps des requêtes (100 ko maximum)
app.use(express.json({ limit: "100kb" }));

// Documentation : Swagger UI sur /docs, le contrat brut sur /openapi.json
app.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Les routes de connexion commencent par /auth
app.use("/auth", authRouter);

// Toutes les routes des tickets commencent par /tickets
app.use("/tickets", ticketsRouter);

// La gestion des comptes commence par /users
app.use("/users", usersRouter);

// Le journal d'audit, réservé au SUPER_ADMIN
app.use("/audit-logs", auditRouter);

// Ces deux-là doivent rester en dernier
app.use(notFound);
app.use(errorHandler);
