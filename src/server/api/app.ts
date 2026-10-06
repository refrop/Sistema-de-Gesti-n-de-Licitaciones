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

export const app = new OpenAPIHono().onError(onError);

const PUBLIC_PATHS = new Set(["/api/health", "/api/spike", "/api/auth/login"]);

app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) {
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

export type AppType = typeof app;
