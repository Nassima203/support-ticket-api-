import express from "express";
import { authRouter } from "./modules/auth/auth.routes";
import { ticketsRouter } from "./modules/tickets/tickets.routes";
import { errorHandler, notFound } from "./middlewares/errors";

export const app = express();

// Permet de lire le JSON envoyé dans le corps des requêtes
app.use(express.json());

// Les routes de connexion commencent par /auth
app.use("/auth", authRouter);

// Toutes les routes des tickets commencent par /tickets
app.use("/tickets", ticketsRouter);

// Ces deux-là doivent rester en dernier
app.use(notFound);
app.use(errorHandler);
