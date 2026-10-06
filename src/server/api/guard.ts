import type { Context } from "hono";
import type { z } from "zod";
import { DomainError } from "../domain/errors";

export async function readJsonBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new DomainError("VALIDATION", "Body JSON inválido");
  }
  return schema.parse(raw);
}
