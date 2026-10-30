/// <reference types="node" />
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être remplis dans .env");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe du Super Admin doit faire au moins 8 caractères");
  }

  // On ne stocke jamais le mot de passe : seulement son empreinte
  const passwordHash = await bcrypt.hash(password, 12);

  // upsert = crée le compte s'il n'existe pas, ne fait rien s'il existe déjà
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Super Admin",
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log(`Super Admin prêt : ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());