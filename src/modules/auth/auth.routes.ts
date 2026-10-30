import { Router, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/password";
import { generateToken, hashToken, refreshTokenExpiry, signAccessToken } from "../../lib/tokens";
import { authenticate } from "../../middlewares/authenticate";
import { loginLimiter } from "../../middlewares/rate-limit";

export const authRouter = Router();

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

  // Access token : court (15 min), envoyé à chaque requête
  const accessToken = signAccessToken(user.id, user.role);

  // Refresh token : long (7 jours), sert à obtenir un nouvel access token
  const refreshToken = generateToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: refreshTokenExpiry(),
    },
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// Voir son propre compte : GET /auth/me
authRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  res.json(user);
});
