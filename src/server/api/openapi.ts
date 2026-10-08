type Json = Record<string, unknown>;

const S = { type: "string" } as const;
const N = { type: "number" } as const;

function jsonBody(description: string, schema: Json = { type: "object" }) {
  return {
    description,
    content: { "application/json": { schema } },
  };
}

function response(description: string) {
  return { description, content: { "application/json": { schema: { type: "object" } } } };
}

function error(description: string) {
  return { description };
}

function pathParam(name: string) {
  return { name, in: "path" as const, required: true, schema: S };
}

function queryParam(name: string, description?: string, schema: Json = S) {
  return { name, in: "query" as const, required: false, description, schema };
}

type Operation = {
  tag: string;
  summary: string;
  description?: string;
  isPublic?: boolean;
  params?: Json[];
  body?: Json;
  responses?: Json;
  codes?: number[];
};

const ERRORS: Record<number, Json> = {
  400: error("400 VALIDATION — datos inválidos"),
  401: error("401 UNAUTHORIZED — sin sesión"),
  403: error("403 FORBIDDEN — rol insuficiente (solo admin)"),
  404: error("404 NOT_FOUND — recurso inexistente"),
  409: error("409 INVALID_TRANSITION / NOT_EDITABLE / INVALID_STATE / CONFLICT"),
  422: error("422 BUDGET_EXCEEDED / MISSING_PROPOSAL / DEADLINE_PASSED / PAYMENT_EXCEEDS_BALANCE"),
  502: error("502 EMAIL_FAILED — Resend no pudo enviar"),
};

function operation({
  tag,
  summary,
  description,
  isPublic,
  params,
  body,
  responses,
  codes = [401],
}: Operation): Json {
  const op: Json = {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(params && params.length ? { parameters: params } : {}),
    ...(body ? { requestBody: body } : {}),
    responses: {
      "200": response("OK"),
      ...Object.fromEntries(codes.map((code) => [String(code), ERRORS[code]])),
      ...(responses ?? {}),
    },
    ...(isPublic ? { security: [] } : {}),
  };
  return op;
}

const loginBody = jsonBody("Credenciales", {
  type: "object",
  required: ["email", "password"],
  properties: { email: S, password: S },
});

const clientBody = jsonBody("Cliente", {
  type: "object",
  required: ["name", "email"],
  properties: { name: S, email: S, phone: S, taxId: S, contactName: S },
});

const productBody = jsonBody("Producto", {
  type: "object",
  required: ["name", "sku", "basePrice"],
  properties: { name: S, sku: S, description: S, basePrice: N },
});

const userBody = jsonBody("Usuario", {
  type: "object",
  required: ["email", "name", "password", "role"],
  properties: { email: S, name: S, password: S, role: { type: "string", enum: ["admin", "user"] } },
});

const tenderBody = jsonBody("Licitación", {
  type: "object",
  required: ["clientId", "title", "maxBudget", "deadline"],
  properties: { clientId: S, title: S, description: S, maxBudget: N, deadline: S },
});

const addProductBody = jsonBody("Línea de producto", {
  type: "object",
  required: ["productId", "quantity"],
  properties: { productId: S, quantity: { type: "integer", minimum: 1 } },
});

const uploadUrlBody = jsonBody("Datos del archivo", {
  type: "object",
  required: ["fileName", "size", "contentType"],
  properties: { fileName: S, size: { type: "integer" }, contentType: S },
});

const confirmBody = jsonBody("Path devuelto por la subida", {
  type: "object",
  required: ["path"],
  properties: { path: S },
});

const invoiceBody = jsonBody("Monto a facturar (vacío = total de productos)", {
  type: "object",
  properties: { amount: N },
});

const paymentBody = jsonBody("Pago", {
  type: "object",
  required: ["amount"],
  properties: { amount: N, note: S },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SisGestLicitaciones API",
    version: "1.0.0",
    description:
      "API del sistema de gestión de licitaciones. Autenticación por cookie `session` " +
      "(tras POST /api/auth/login) o `Authorization: Bearer <JWT>`. Toda mutación exige " +
      "`Content-Type: application/json`, salvo la subida del PDF (`application/pdf`). " +
      "Errores: `{ error: { code, message, details? } }`.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "auth", description: "Login y sesión" },
    { name: "users", description: "Usuarios (solo admin)" },
    { name: "clients", description: "Clientes" },
    { name: "products", description: "Catálogo de productos" },
    { name: "tenders", description: "Licitaciones" },
    { name: "proposal", description: "Documento PDF de propuesta" },
    { name: "cycle", description: "Envío, facturación y pagos" },
    { name: "system", description: "Health, cron y documentación" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    "/api/auth/login": {
      post: operation({
        tag: "auth",
        summary: "Login",
        description: "Devuelve la cookie httpOnly `session` (8 h).",
        isPublic: true,
        body: loginBody,
        codes: [400, 401],
        responses: { "200": response("Sesión iniciada") },
      }),
    },
    "/api/auth/logout": {
      post: operation({ tag: "auth", summary: "Logout", codes: [401] }),
    },
    "/api/auth/me": {
      get: operation({ tag: "auth", summary: "Usuario actual", codes: [401] }),
    },
    "/api/users": {
      get: operation({
        tag: "users",
        summary: "Lista usuarios",
        params: [queryParam("q", "Búsqueda por email o nombre"), queryParam("page"), queryParam("pageSize")],
        codes: [401, 403],
      }),
      post: operation({
        tag: "users",
        summary: "Crea usuario (admin)",
        body: userBody,
        codes: [400, 401, 403, 409],
      }),
    },
    "/api/clients": {
      get: operation({
        tag: "clients",
        summary: "Lista clientes",
        params: [queryParam("q", "Búsqueda por nombre o email"), queryParam("page"), queryParam("pageSize")],
        codes: [401],
      }),
      post: operation({ tag: "clients", summary: "Crea cliente", body: clientBody, codes: [400, 401] }),
    },
    "/api/products": {
      get: operation({
        tag: "products",
        summary: "Lista productos",
        params: [queryParam("q", "Búsqueda por nombre o SKU"), queryParam("page"), queryParam("pageSize")],
        codes: [401],
      }),
      post: operation({
        tag: "products",
        summary: "Crea producto",
        body: productBody,
        codes: [400, 401, 409],
      }),
    },
    "/api/tenders": {
      get: operation({
        tag: "tenders",
        summary: "Lista licitaciones",
        params: [
          queryParam("q", "Búsqueda por título o descripción"),
          queryParam("status", "Filtro por estado", { type: "string", enum: ["borrador", "activa", "finalizada", "por_cobrar", "cobrada", "perdida"] }),
          queryParam("clientId", "Filtro por cliente"),
          queryParam("page"),
          queryParam("pageSize"),
        ],
        codes: [401],
      }),
      post: operation({
        tag: "tenders",
        summary: "Crea licitación en borrador",
        description: "Registra también el historial (`reason: creacion`).",
        body: tenderBody,
        codes: [400, 401, 404],
        responses: { "201": response("Licitación creada") },
      }),
    },
    "/api/tenders/expiring": {
      get: operation({
        tag: "tenders",
        summary: "Licitaciones activas próximas a vencer",
        params: [queryParam("days", "Días de ventana (default 3)", { type: "integer", minimum: 0, maximum: 365 })],
        codes: [400, 401],
      }),
    },
    "/api/tenders/{id}": {
      get: operation({
        tag: "tenders",
        summary: "Detalle de licitación",
        description: "Cliente, productos con subtotales, totales, pagos, saldo, historial y correos.",
        params: [pathParam("id")],
        codes: [401, 404],
      }),
    },
    "/api/tenders/{id}/transitions": {
      get: operation({
        tag: "tenders",
        summary: "Historial de estados",
        params: [pathParam("id")],
        codes: [401, 404],
      }),
    },
    "/api/tenders/{id}/products": {
      post: operation({
        tag: "tenders",
        summary: "Agrega producto (upsert de cantidad)",
        description: "Valida la regla de presupuesto con Decimal.",
        params: [pathParam("id")],
        body: addProductBody,
        codes: [400, 401, 404, 409, 422],
        responses: { "201": response("Línea creada o actualizada") },
      }),
    },
    "/api/tenders/{id}/products/{productId}": {
      delete: operation({
        tag: "tenders",
        summary: "Quita producto de la licitación",
        params: [pathParam("id"), pathParam("productId")],
        codes: [401, 404, 409],
      }),
    },
    "/api/tenders/{id}/proposal/upload-url": {
      post: operation({
        tag: "proposal",
        summary: "Signed URL para subir el PDF directo a Storage",
        description: "Requiere `borrador`; solo para clientes que hablen con Storage.",
        params: [pathParam("id")],
        body: uploadUrlBody,
        codes: [400, 401, 404, 409],
      }),
    },
    "/api/tenders/{id}/proposal/confirm": {
      post: operation({
        tag: "proposal",
        summary: "Confirma el documento subido",
        description: "Revalida tamaño y tipo con los metadatos reales de Storage.",
        params: [pathParam("id")],
        body: confirmBody,
        codes: [400, 401, 404, 409],
      }),
    },
    "/api/tenders/{id}/proposal/upload": {
      post: operation({
        tag: "proposal",
        summary: "Sube el PDF por la API (lo usa la UI)",
        description:
          "Body binario con `Content-Type: application/pdf` y header `x-file-name`. " +
          "Límite 10 MB en el servicio (4 MB desde el navegador por el límite de Vercel).",
        params: [pathParam("id")],
        body: {
          description: "Archivo PDF",
          required: true,
          content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
        },
        codes: [400, 401, 404, 409],
        responses: { "201": response("Documento guardado en la licitación") },
      }),
    },
    "/api/tenders/{id}/send": {
      post: operation({
        tag: "cycle",
        summary: "Envía la propuesta por correo y pasa a `activa`",
        description: "Si Resend falla → 502 y la licitación sigue en `borrador`.",
        params: [pathParam("id")],
        codes: [401, 404, 409, 422, 502],
      }),
    },
    "/api/tenders/{id}/invoice": {
      post: operation({
        tag: "cycle",
        summary: "`finalizada → por_cobrar` con `invoicedAmount`",
        description: "Sin `amount`, factura el total de productos.",
        params: [pathParam("id")],
        body: invoiceBody,
        codes: [400, 401, 404, 409],
      }),
    },
    "/api/tenders/{id}/payments": {
      post: operation({
        tag: "cycle",
        summary: "Registra un pago",
        description: "Si el saldo llega a 0 pasa automáticamente a `cobrada`.",
        params: [pathParam("id")],
        body: paymentBody,
        codes: [400, 401, 404, 409, 422],
        responses: { "201": response("Pago registrado") },
      }),
    },
    "/api/tenders/{id}/finalize": {
      post: operation({
        tag: "cycle",
        summary: "`activa → finalizada`",
        params: [pathParam("id")],
        codes: [401, 404, 409],
      }),
    },
    "/api/tenders/{id}/lose": {
      post: operation({
        tag: "cycle",
        summary: "`activa → perdida`",
        params: [pathParam("id")],
        codes: [401, 404, 409],
      }),
    },
    "/api/cron/tick": {
      get: operation({
        tag: "system",
        summary: "Jobs: vencimiento + recordatorio",
        description: "Requiere header `Authorization: Bearer <CRON_SECRET>`.",
        isPublic: true,
        codes: [401],
      }),
    },
    "/api/health": {
      get: operation({
        tag: "system",
        summary: "Health check",
        isPublic: true,
        codes: [],
        responses: { "200": response("{ status, time, db }") },
      }),
    },
    "/api/spike": {
      get: operation({
        tag: "system",
        summary: "Prueba temporal de integraciones (fase 1)",
        isPublic: true,
        codes: [],
      }),
    },
    "/api/openapi.json": {
      get: operation({
        tag: "system",
        summary: "Spec OpenAPI (este documento)",
        isPublic: true,
        codes: [],
      }),
    },
    "/api/docs": {
      get: operation({
        tag: "system",
        summary: "Swagger UI",
        isPublic: true,
        codes: [],
      }),
    },
  },
};
