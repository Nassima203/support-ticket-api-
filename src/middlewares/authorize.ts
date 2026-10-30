import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

// Laisse passer seulement les rôles indiqués, par exemple authorize("ADMIN", "SUPER_ADMIN")
// À placer après authenticate, qui remplit req.user
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Connexion requise" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Action non autorisée pour ton rôle" });
      return;
    }

    next();
  };
}
