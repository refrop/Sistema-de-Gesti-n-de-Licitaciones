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

  // Cliente demo (opcional): con EMAIL_FROM sin dominio verificado, el envío
  // solo llega si el destinatario es el titular. SEED_CLIENT_EMAIL apunta a ese
  // correo; si no está definida, no se crea ningún cliente.
  const clientEmail = process.env.SEED_CLIENT_EMAIL?.trim();
  if (!clientEmail) {
    console.log("SEED_CLIENT_EMAIL no definida: se omite el cliente demo");
  } else {
    const data = {
      name: "Cliente Demo (evaluacion)",
      contactName: "Correo del titular de la cuenta",
    };
    const existing = await prisma.client.findFirst({ where: { email: clientEmail } });
    const client = existing
      ? await prisma.client.update({ where: { id: existing.id }, data })
      : await prisma.client.create({ data: { ...data, email: clientEmail } });
    console.log(`Cliente demo listo: ${client.email} (id=${client.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
