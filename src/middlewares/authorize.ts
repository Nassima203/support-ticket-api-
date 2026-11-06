import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "../lib/http-error";

// Laisse passer seulement les rôles indiqués, par exemple authorize("ADMIN", "SUPER_ADMIN")
// À placer après authenticate, qui remplit req.user
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new HttpError(401, "Connexion requise");
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Action non autorisée pour ton rôle");
    }

    next();
  };
}
