import { z } from "zod";
import { emailField, newPasswordField, requiredString } from "../../lib/schemas";

export const loginSchema = z.object({
  email: emailField,
  password: requiredString("password"),
});

export const refreshTokenSchema = z.object({
  refreshToken: requiredString("refreshToken"),
});

// Accepter une invitation ou réinitialiser son mot de passe : un jeton reçu par email + le nouveau mot de passe
export const tokenWithPasswordSchema = z.object({
  token: requiredString("token"),
  password: newPasswordField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});
