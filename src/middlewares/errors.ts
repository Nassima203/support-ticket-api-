import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error";

// Appelé quand aucune route ne correspond à l'adresse demandée
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route introuvable" });
}

// Type des erreurs levées par express.json() : "entity.parse.failed", "entity.too.large"…
function bodyErrorType(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { type?: string }).type : undefined;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Erreur prévue, levée par un contrôleur ou un service
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (bodyErrorType(err) === "entity.parse.failed") {
    res.status(400).json({ error: "Le corps de la requête n'est pas un JSON valide" });
    return;
  }

  if (bodyErrorType(err) === "entity.too.large") {
    res.status(413).json({ error: "Le corps de la requête est trop gros (100 ko maximum)" });
    return;
  }

  // Filet de sécurité : toute erreur imprévue renvoie un 500 propre
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur" });
}
