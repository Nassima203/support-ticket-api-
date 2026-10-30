import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import * as usersController from "./users.controller";

export const usersRouter = Router();

// Toutes les routes des utilisateurs : connecté ET admin ou super admin
usersRouter.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

usersRouter.post("/", usersController.create);
usersRouter.get("/", usersController.list);
usersRouter.post("/:id/resend-invitation", usersController.resendInvitation);
