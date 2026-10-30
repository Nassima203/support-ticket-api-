import { Role } from "@prisma/client";

// Ajoute req.user à Express : l'utilisateur connecté, rempli par le middleware authenticate
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
