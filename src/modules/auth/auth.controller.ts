import { Request, Response } from "express";
import { HttpError } from "../../lib/http-error";
import { normalizeEmail } from "../../lib/normalize-email";
import * as authService from "./auth.service";

// Lit un jeton obligatoire du corps, ou lève une erreur 400
function requireToken(value: unknown, field: string): string {
  if (!value || typeof value !== "string") throw new HttpError(400, `${field} est obligatoire`);
  return value;
}

// Lit un nouveau mot de passe d'au moins 8 caractères, ou lève une erreur 400
function requireNewPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new HttpError(400, "Le mot de passe doit faire au moins 8 caractères");
  }
  return value;
}

// POST /auth/login
export async function login(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || typeof password !== "string" || !password) {
    throw new HttpError(400, "email et password sont obligatoires");
  }

  res.json(await authService.login(email, password));
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response) {
  const refreshToken = requireToken(req.body?.refreshToken, "refreshToken");
  res.json(await authService.refresh(refreshToken));
}

// POST /auth/logout
export async function logout(req: Request, res: Response) {
  const refreshToken = requireToken(req.body?.refreshToken, "refreshToken");
  await authService.logout(refreshToken);
  res.status(204).end();
}

// POST /auth/accept-invitation
export async function acceptInvitation(req: Request, res: Response) {
  const token = requireToken(req.body?.token, "token");
  const password = requireNewPassword(req.body?.password);
  await authService.acceptInvitation(token, password);
  res.json({ message: "Mot de passe enregistré, tu peux te connecter" });
}

// POST /auth/forgot-password
export async function forgotPassword(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  if (!email) throw new HttpError(400, "email est obligatoire");

  await authService.forgotPassword(email);

  // Toujours la même réponse : on ne révèle pas quels emails ont un compte
  res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé" });
}

// POST /auth/reset-password
export async function resetPassword(req: Request, res: Response) {
  const token = requireToken(req.body?.token, "token");
  const password = requireNewPassword(req.body?.password);
  await authService.resetPassword(token, password);
  res.json({ message: "Mot de passe modifié, tu peux te connecter" });
}

// GET /auth/me
export async function me(req: Request, res: Response) {
  res.json(await authService.getProfile(req.user!.id));
}
