import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { verifyAccessToken } from "../lib/tokens";

// Vérifie que la requête vient d'un utilisateur connecté et actif
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // 1. Lire l'en-tête "Authorization: Bearer <token>"
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Connexion requise" });
    return;
  }

  // 2. Vérifier le jeton
  const payload = verifyAccessToken(header.slice("Bearer ".length));

  if (!payload) {
    res.status(401).json({ error: "Jeton invalide ou expiré" });
    return;
  }

  // 3. Vérifier que le compte existe toujours et qu'il est actif
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Compte introuvable ou désactivé" });
    return;
  }

  // 4. Ranger l'utilisateur dans la requête pour les routes suivantes
  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}
