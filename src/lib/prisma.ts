import { PrismaClient } from "@prisma/client";

// Une seule connexion à la base, utilisée par tout le projet
export const prisma = new PrismaClient();