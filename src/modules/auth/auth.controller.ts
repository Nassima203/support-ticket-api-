import { Request, Response } from "express";
import { validate } from "../../lib/validate";
import * as authService from "./auth.service";
import { forgotPasswordSchema, loginSchema, refreshTokenSchema, tokenWithPasswordSchema } from "./auth.schemas";

// POST /auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = validate(loginSchema, req.body ?? {});
  res.json(await authService.login(email, password));
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = validate(refreshTokenSchema, req.body ?? {});
  res.json(await authService.refresh(refreshToken));
}

// POST /auth/logout
export async function logout(req: Request, res: Response) {
  const { refreshToken } = validate(refreshTokenSchema, req.body ?? {});
  await authService.logout(refreshToken);
  res.status(204).end();
}

// POST /auth/accept-invitation
export async function acceptInvitation(req: Request, res: Response) {
  const { token, password } = validate(tokenWithPasswordSchema, req.body ?? {});
  await authService.acceptInvitation(token, password);
  res.json({ message: "Mot de passe enregistré, tu peux te connecter" });
}

// POST /auth/forgot-password
export async function forgotPassword(req: Request, res: Response) {
  const { email } = validate(forgotPasswordSchema, req.body ?? {});
  await authService.forgotPassword(email);

  // Toujours la même réponse : on ne révèle pas quels emails ont un compte
  res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" });
}

// POST /auth/reset-password
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = validate(tokenWithPasswordSchema, req.body ?? {});
  await authService.resetPassword(token, password);
  res.json({ message: "Mot de passe modifié, tu peux te connecter" });
}

// GET /auth/me
export async function me(req: Request, res: Response) {
  res.json(await authService.getProfile(req.user!.id));
}
