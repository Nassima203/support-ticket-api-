import { z } from "zod";
import { HttpError } from "./http-error";

// Vérifie une valeur avec un schéma zod : renvoie la donnée propre, ou lève une erreur 400
// avec le message du premier problème trouvé
export function validate<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new HttpError(400, result.error.issues[0].message);
  }

  return result.data;
}
