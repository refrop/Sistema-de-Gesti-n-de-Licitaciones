import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Faltan SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD en el entorno");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name: "Administrador", passwordHash, role: "admin", active: true },
    create: { email, name: "Administrador", passwordHash, role: "admin", active: true },
  });

  console.log(`Admin listo: ${admin.email} (id=${admin.id})`);

  const demoEmail = process.env.SEED_USER_EMAIL ?? "user@example.com";
  const demoPassword = process.env.SEED_USER_PASSWORD ?? password;
  const demoHash = await bcrypt.hash(demoPassword, 10);

  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: "Usuario Demo", passwordHash: demoHash, role: "user", active: true },
    create: { email: demoEmail, name: "Usuario Demo", passwordHash: demoHash, role: "user", active: true },
  });

  console.log(`Usuario demo listo: ${demo.email} (id=${demo.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
