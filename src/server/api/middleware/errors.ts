import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { DomainError } from "../../domain/errors";

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof DomainError) {
    return c.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      err.status as ContentfulStatusCode,
    );
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: { code: "VALIDATION", message: "Datos de entrada inválidos", details: err.issues } },
      400,
    );
  }
  console.error("[api]", err);
  return c.json(
    { error: { code: "INTERNAL", message: "Error interno del servidor" } },
    500,
  );
};
