import { CurrentUser } from "./current-user";

// Ajoute req.user à Express : l'utilisateur connecté, rempli par le middleware authenticate
declare global {
  namespace Express {
    interface Request {
      user?: CurrentUser;
    }
  }
}

export {};
