import { Hono } from "hono";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import { runTick } from "../../jobs/tick";

function safeEqual(a: string, b: string): boolean {
  // SHA-256 iguala longitudes antes de comparar en tiempo constante
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const cronRoutes = new Hono().get("/api/cron/tick", async (c) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Cron secret inválido" } },
      401,
    );
  }
  return c.json(await runTick());
});
