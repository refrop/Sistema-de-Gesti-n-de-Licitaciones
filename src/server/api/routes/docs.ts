import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { openApiDocument } from "../openapi";

export const docsRoutes = new Hono()
  .get("/api/openapi.json", (c) => c.json(openApiDocument))
  .get(
    "/api/docs",
    swaggerUI({
      url: "/api/openapi.json",
      title: "SisGestLicitaciones API",
      docExpansion: "list",
      persistAuthorization: true,
    }),
  );
