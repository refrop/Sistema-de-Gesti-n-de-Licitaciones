/**
 * Reporte de estado de la base de datos (alternativa a `prisma migrate status`,
 * que se cuelga contra el pooler tx de Supabase en esta red).
 *
 * Uso: node scripts/db-report.js
 *   - Compara prisma/migrations/* con las filas de _prisma_migrations
 *     (nombre, checksum sha256, finished_at).
 *   - Lista tablas, índices, FKs y CHECKs.
 *   - Verifica el admin sembrado (bcrypt contra SEED_ADMIN_PASSWORD).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { PrismaClient } = require(path.join(root, "node_modules", "@prisma/client"));
const bcrypt = require(path.join(root, "node_modules", "bcryptjs"));
const p = new PrismaClient();

let failures = 0;
function check(ok, label, detail) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

(async () => {
  const dirs = fs
    .readdirSync(path.join(root, "prisma", "migrations"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const rows = await p.$queryRawUnsafe(
    "SELECT migration_name, checksum, finished_at FROM _prisma_migrations ORDER BY migration_name",
  );
  const byName = new Map(rows.map((r) => [r.migration_name, r]));

  console.log("== Migraciones ==");
  for (const name of dirs) {
    const sha = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "prisma", "migrations", name, "migration.sql")))
      .digest("hex");
    const row = byName.get(name);
    check(
      !!row && row.checksum === sha && row.finished_at !== null,
      name,
      !row
        ? "no aplicada en BD"
        : row.checksum !== sha
          ? "checksum mismatch"
          : row.finished_at === null
            ? "finished_at NULL"
            : "aplicada",
    );
  }
  for (const row of rows) {
    check(dirs.includes(row.migration_name), `fila ${row.migration_name}`, dirs.includes(row.migration_name) ? "" : "huérfana en BD");
  }

  console.log("\n== Esquema ==");
  const tables = await p.$queryRawUnsafe(
    "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const expectedTables = [
    "_prisma_migrations", "clients", "email_logs", "payments", "products",
    "tender_products", "tender_transitions", "tenders", "users",
  ];
  const tableNames = tables.map((t) => t.name);
  check(
    expectedTables.every((t) => tableNames.includes(t)),
    "tablas esperadas presentes",
    tableNames.join(", "),
  );

  const fks = await p.$queryRawUnsafe(
    "SELECT count(*)::int AS n FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f'",
  );
  check(fks[0].n === 6, "foreign keys", `${fks[0].n}/6`);

  const checks = await p.$queryRawUnsafe(
    "SELECT conname AS name FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c' ORDER BY conname",
  );
  const expectedChecks = [
    "chk_base_price_nonneg", "chk_max_budget_pos", "chk_payment_pos",
    "chk_qty_pos", "chk_unit_price_nonneg",
  ];
  const checkNames = checks.map((c) => c.name);
  check(
    expectedChecks.every((c) => checkNames.includes(c)),
    "CHECK constraints",
    checkNames.join(", ") || "(ninguno)",
  );

  const idx = await p.$queryRawUnsafe(
    "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname <> '_prisma_migrations_pkey'",
  );
  check(idx[0].n === 17, "índices (sin pkey de _prisma_migrations)", `${idx[0].n}/17`);

  console.log("\n== Admin sembrado ==");
  const users = await p.$queryRawUnsafe("SELECT email, name, role, active, password_hash FROM users");
  const admin = users.find((u) => u.email === process.env.SEED_ADMIN_EMAIL);
  check(!!admin, "usuario admin existe", admin ? `${admin.email} (${admin.role})` : "no encontrado");
  if (admin) {
    check(admin.role === "admin" && admin.active === true, "rol admin + activo");
    const match = await bcrypt.compare(process.env.SEED_ADMIN_PASSWORD, admin.password_hash);
    check(match, "password hash coincide con SEED_ADMIN_PASSWORD");
  }
  check(users.length === 1, "solo 1 usuario en BD", `${users.length} usuario(s)`);

  console.log(`\n${failures === 0 ? "TODO OK" : failures + " FALLO(S)"}`);
  await p.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
})();
