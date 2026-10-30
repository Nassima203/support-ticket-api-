// Met un email au même format partout : sans espaces autour et en minuscules
// Ainsi, "Bob@Mail.com " et "bob@mail.com" désignent le même compte
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
