import { Router, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/password";
import { generateToken, hashToken, refreshTokenExpiry, signAccessToken } from "../../lib/tokens";
import { authenticate } from "../../middlewares/authenticate";
import { loginLimiter } from "../../middlewares/rate-limit";

export const authRouter = Router();

// Crée une session : un access token (15 min) et un refresh token (7 jours) enregistré en base
async function createSession(userId: number, role: Role) {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = generateToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId,
      expiresAt: refreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
}

// Se connecter : POST /auth/login
authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email et password sont obligatoires" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Même message dans tous les cas d'échec : on ne révèle pas si l'email existe
  const valid =
    user !== null &&
    user.isActive &&
    user.passwordHash !== null &&
    (await verifyPassword(password, user.passwordHash));

  if (!user || !valid) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const tokens = await createSession(user.id, user.role);

  res.json({
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// Obtenir de nouveaux jetons : POST /auth/refresh
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken est obligatoire" });
    return;
  }

  // On retrouve la session grâce à l'empreinte du jeton
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });

  if (!stored) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }

  // Jeton déjà utilisé : quelqu'un a pu le voler. On ferme toutes les sessions de ce compte.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(401).json({ error: "Session révoquée, reconnecte-toi" });
    return;
  }

  if (stored.expiresAt < new Date() || !stored.user.isActive) {
    res.status(401).json({ error: "Session expirée ou compte désactivé" });
    return;
  }

  // Rotation : l'ancien refresh token est révoqué, un nouveau le remplace
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await createSession(stored.user.id, stored.user.role);

  res.json(tokens);
});

// Se déconnecter : POST /auth/logout
authRouter.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken est obligatoire" });
    return;
  }

  // On révoque la session. Si le jeton n'existe pas, on répond pareil : rien à révéler.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.status(204).end();
});

// Voir son propre compte : GET /auth/me
authRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  res.json(user);
});