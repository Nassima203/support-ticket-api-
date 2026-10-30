import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { loginLimiter, passwordResetLimiter } from "../../middlewares/rate-limit";
import * as authController from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.post("/accept-invitation", authController.acceptInvitation);
authRouter.post("/forgot-password", passwordResetLimiter, authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.get("/me", authenticate, authController.me);
