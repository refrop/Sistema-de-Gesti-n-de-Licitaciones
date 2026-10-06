import { Hono } from "hono";
import { db } from "../../lib/db";

export const systemRoutes = new Hono().get("/api/health", async (c) => {
  let dbStatus: "up" | "down" = "down";
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = "up";
  } catch {
    dbStatus = "down";
  }
  return c.json({
    status: "ok",
    time: new Date().toISOString(),
    db: dbStatus,
  });
});
