import { describe, it, expect, afterAll } from "vitest";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";

type Operation = {
  security?: unknown[];
  responses?: Record<string, unknown>;
};
type Spec = {
  openapi: string;
  info: { title: string };
  paths: Record<string, Record<string, Operation>>;
  components: { securitySchemes: Record<string, unknown> };
};

// Lista exacta del spec: un endpoint nuevo, renombrado o borrado hace fallar el
// test (en vez de un umbral que nunca se mueve).
const EXPECTED_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/cron/tick",
  "/api/clients",
  "/api/docs",
  "/api/health",
  "/api/openapi.json",
  "/api/products",
  "/api/tenders",
  "/api/tenders/{id}",
  "/api/tenders/{id}/finalize",
  "/api/tenders/{id}/invoice",
  "/api/tenders/{id}/lose",
  "/api/tenders/{id}/payments",
  "/api/tenders/{id}/products",
  "/api/tenders/{id}/products/{productId}",
  "/api/tenders/{id}/proposal/confirm",
  "/api/tenders/{id}/proposal/upload",
  "/api/tenders/{id}/proposal/upload-url",
  "/api/tenders/{id}/send",
  "/api/tenders/{id}/transitions",
  "/api/tenders/expiring",
  "/api/users",
].sort();

const EXPECTED_OPERATIONS = 28;

const PUBLIC_OPS: [string, string][] = [
  ["/api/auth/login", "post"],
  ["/api/cron/tick", "get"],
  ["/api/health", "get"],
  ["/api/openapi.json", "get"],
  ["/api/docs", "get"],
];

function isPublic(path: string, method: string): boolean {
  return PUBLIC_OPS.some(([p, m]) => p === path && m === method);
}

describe("documentación de la API", () => {
  it("GET /api/openapi.json documenta exactamente las rutas esperadas", async () => {
    const res = await app.request("/api/openapi.json");
    expect(res.status).toBe(200);

    const spec = (await res.json()) as Spec;
    expect(String(spec.openapi)).toMatch(/^3\./);
    expect(spec.info.title).toContain("Licitaciones");

    const paths = Object.keys(spec.paths).sort();
    expect(paths).toEqual(EXPECTED_PATHS);
    expect(paths).not.toContain("/api/spike");

    const operations = paths.reduce(
      (total, path) => total + Object.keys(spec.paths[path]).length,
      0,
    );
    expect(operations).toBe(EXPECTED_OPERATIONS);

    expect(spec.components.securitySchemes.cookieAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("las operaciones protegidas exigen auth y las públicas no", async () => {
    const res = await app.request("/api/openapi.json");
    const spec = (await res.json()) as Spec;

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (isPublic(path, method)) {
          expect(operation.security, `${method.toUpperCase()} ${path}`).toEqual([]);
        } else {
          expect(operation.security, `${method.toUpperCase()} ${path}`).toBeUndefined();
          expect(
            operation.responses?.["401"],
            `${method.toUpperCase()} ${path} debe documentar 401`,
          ).toBeDefined();
        }
      }
    }
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

    // Sin sesión la muralla de auth contesta antes de que se resuelva la ruta
    // (el spike ya no existe: sin cookie → 401; con cookie → 404).
    const spike = await app.request("/api/spike");
    expect(spike.status).toBe(401);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
