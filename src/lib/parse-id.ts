import { HttpError } from "./http-error";

// Transforme "12" en 12, ou lève une erreur 400 si ce n'est pas un entier positif
export function parseId(value: string | string[]): number {
  const id = Array.isArray(value) ? NaN : Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "L'id doit être un nombre entier positif");
  }

  return id;
}
