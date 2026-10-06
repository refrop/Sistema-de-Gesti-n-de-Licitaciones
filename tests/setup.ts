import { readFileSync } from "node:fs";
import path from "node:path";

// Carga .env (solo si la variable no está ya definida) antes de importar
// cualquier módulo que valide el entorno.
try {
  const raw = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // sin .env: se confía en el entorno del sistema
}
