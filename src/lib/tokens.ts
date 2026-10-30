import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

// Ce que contient l'access token
export type AccessTokenPayload = {
  sub: number;
  role: Role;
};

// Crée un access token (JWT) valable 15 minutes
export function signAccessToken(userId: number, role: Role): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: String(userId),
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  });
}

// Vérifie un access token : renvoie son contenu, ou null s'il est faux ou expiré
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === "string" || !decoded.sub) return null;
    return { sub: Number(decoded.sub), role: decoded.role as Role };
  } catch {
    return null;
  }
}

// Crée un jeton aléatoire (refresh token, invitation, réinitialisation)
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Empreinte d'un jeton : c'est elle qu'on stocke en base, jamais le jeton lui-même
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Date d'expiration du refresh token
export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}
