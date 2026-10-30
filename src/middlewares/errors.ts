import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";

// Appelé quand aucune route ne correspond à l'adresse demandée
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route introuvable" });
}

// Corps de requête illisible : express.json() lève une erreur de type "entity.parse.failed"
function isInvalidJson(err: unknown): boolean {
  return err instanceof SyntaxError && (err as { type?: string }).type === "entity.parse.failed";
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Erreur prévue, levée par un contrôleur ou un service
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (isInvalidJson(err)) {
    res.status(400).json({ error: "Le corps de la requête n'est pas un JSON valide" });
    return;
  }

  // Filet de sécurité : toute erreur imprévue renvoie un 500 propre
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur" });
}
