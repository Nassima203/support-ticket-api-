import { z } from "zod";

// Champs réutilisés par plusieurs modules

// Email : sans espaces autour, en minuscules, au bon format
export const emailField = z
  .string({ error: "Un email valide est obligatoire" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Un email valide est obligatoire" }));

// Nouveau mot de passe : bcrypt ne lit que les 72 premiers octets, d'où la limite haute
const passwordError = "Le mot de passe doit faire entre 8 et 72 caractères";
export const newPasswordField = z
  .string({ error: passwordError })
  .min(8, { error: passwordError })
  .max(72, { error: passwordError });

// Texte obligatoire et non vide (un jeton, un mot de passe à vérifier…)
export function requiredString(field: string) {
  return z.string({ error: `${field} est obligatoire` }).min(1, { error: `${field} est obligatoire` });
}
