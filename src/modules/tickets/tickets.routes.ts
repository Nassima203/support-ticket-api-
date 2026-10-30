import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import * as ticketsController from "./tickets.controller";

export const ticketsRouter = Router();

// Toutes les routes des tickets demandent d'être connecté
ticketsRouter.use(authenticate);

// Tous les rôles
ticketsRouter.post("/", ticketsController.create);
ticketsRouter.get("/", ticketsController.list);
ticketsRouter.get("/:id", ticketsController.getOne);

// AGENT, ADMIN, SUPER_ADMIN seulement
ticketsRouter.patch("/:id/status", authorize("AGENT", "ADMIN", "SUPER_ADMIN"), ticketsController.updateStatus);
