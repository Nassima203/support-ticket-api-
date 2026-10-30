import { NextFunction, Request, Response } from "express";

// Appelé quand aucune route ne correspond à l'adresse demandée
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route introuvable" });
}

// Filet de sécurité : toute erreur imprévue renvoie un 500 propre
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur" });
}
