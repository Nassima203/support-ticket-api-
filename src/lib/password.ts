import bcrypt from "bcryptjs";

// Transforme un mot de passe en empreinte (12 = niveau de difficulté du calcul)
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Vérifie qu'un mot de passe correspond à une empreinte enregistrée
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
