const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const rows = await p.tenderTransition.findMany({ orderBy: { createdAt: "asc" } });
  console.log("filas en tender_transitions:", rows.length);
  rows.forEach((r) =>
    console.log(" -", r.fromStatus, "->", r.toStatus, "| reason:", r.reason, "| user:", r.userId),
  );
  const tenders = await p.tender.findMany({
    where: { title: "Licitación camino completo" },
    select: { id: true, status: true, title: true },
  });
  console.log("licitación demo:", JSON.stringify(tenders));
  await p.$disconnect();
})();
