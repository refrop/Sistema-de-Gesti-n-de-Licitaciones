import { describe, it, expect, afterAll } from "vitest";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";

type Spec = {
  openapi: string;
  info: { title: string };
  paths: Record<string, Record<string, unknown>>;
  components: { securitySchemes: Record<string, unknown> };
};

describe("documentación de la API", () => {
  it("GET /api/openapi.json es público y documenta la API", async () => {
    const res = await app.request("/api/openapi.json");
    expect(res.status).toBe(200);

    const spec = (await res.json()) as Spec;
    expect(String(spec.openapi)).toMatch(/^3\./);
    expect(spec.info.title).toContain("Licitaciones");

    const paths = Object.keys(spec.paths);
    expect(paths.length).toBeGreaterThanOrEqual(25);

    const operations = paths.reduce(
      (total, path) => total + Object.keys(spec.paths[path]).length,
      0,
    );
    expect(operations).toBeGreaterThanOrEqual(26);

    expect(paths).toContain("/api/tenders/{id}");
    expect(paths).toContain("/api/tenders/{id}/proposal/upload");
    expect(paths).toContain("/api/tenders/{id}/payments");
    expect(spec.components.securitySchemes.cookieAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("GET /api/docs sirve Swagger UI apuntando al spec", async () => {
    const res = await app.request("/api/docs");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("swagger");
    expect(html).toContain("/api/openapi.json");
  });

  it("los docs no exigen sesión, pero las mutaciones sí", async () => {
    const docs = await app.request("/api/openapi.json");
    expect(docs.status).toBe(200);

    const protectedRoute = await app.request("/api/tenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(protectedRoute.status).toBe(401);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
