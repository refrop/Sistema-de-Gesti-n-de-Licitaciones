import { OpenAPIHono } from "@hono/zod-openapi";
import { onError } from "./middleware/errors";
import { requireAuth } from "./middleware/auth";
import { DomainError } from "../domain/errors";
import { systemRoutes } from "./routes/system";
import { spikeRoutes } from "./routes/spike";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { clientRoutes } from "./routes/clients";
import { productRoutes } from "./routes/products";
import { tenderRoutes } from "./routes/tenders";
import { cronRoutes } from "./routes/cron";
import { docsRoutes } from "./routes/docs";

export const app = new OpenAPIHono().onError(onError);

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/spike",
  "/api/auth/login",
  "/api/cron/tick",
  "/api/openapi.json",
  "/api/docs",
]);

// La subida del PDF llega con Content-Type application/pdf (no JSON). Un sitio
// cruzado no puede emitir ese tipo desde un form, asi que el content-type hace
// de proteccion CSRF; la sesion sigue exigiendose abajo.
const RAW_UPLOAD_PATH = /^\/api\/tenders\/[^/]+\/proposal\/upload$/;

app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const contentType = c.req.header("content-type") ?? "";
    if (!RAW_UPLOAD_PATH.test(c.req.path) && !contentType.includes("application/json")) {
      throw new DomainError(
        "VALIDATION",
        "Las mutaciones requieren Content-Type: application/json",
      );
    }
  }
  if (PUBLIC_PATHS.has(c.req.path)) return next();
  return requireAuth(c, next);
});

app.route("/", systemRoutes);
app.route("/", spikeRoutes);
app.route("/", authRoutes);
app.route("/", userRoutes);
app.route("/", clientRoutes);
app.route("/", productRoutes);
app.route("/", tenderRoutes);
app.route("/", cronRoutes);
app.route("/", docsRoutes);

export type AppType = typeof app;
