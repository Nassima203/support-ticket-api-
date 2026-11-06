import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import * as auditController from "./audit.controller";

export const auditRouter = Router();

// Le journal d'audit est réservé au SUPER_ADMIN : il montre aussi les actions des ADMIN
auditRouter.use(authenticate, authorize("SUPER_ADMIN"));

auditRouter.get("/", auditController.list);
