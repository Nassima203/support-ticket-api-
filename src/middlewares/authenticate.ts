import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http-error";
import { verifyAccessToken } from "../lib/tokens";

// Vérifie que la requête vient d'un utilisateur connecté et actif
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  // 1. Lire l'en-tête "Authorization: Bearer <token>"
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Connexion requise");
  }

  // 2. Vérifier le jeton
  const payload = verifyAccessToken(header.slice("Bearer ".length));

  if (!payload) {
    throw new HttpError(401, "Jeton invalide ou expiré");
  }

  // 3. Vérifier que le compte existe toujours et qu'il est actif
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Compte introuvable ou désactivé");
  }

  // 4. Ranger l'utilisateur dans la requête pour les routes suivantes
  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}
