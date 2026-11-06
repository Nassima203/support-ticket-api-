import { afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";

// Aucun vrai email pendant les tests : on garde les emails en mémoire pour lire leurs liens
vi.mock("../src/lib/mailer", () => ({ sendEmail: vi.fn() }));

afterAll(async () => {
  await prisma.$disconnect();
});
