import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.email("Correo inválido"),
  phone: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
});

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  sku: z.string().trim().min(1, "El SKU es obligatorio"),
  description: z.string().trim().optional(),
  basePrice: z.coerce.number().positive("Debe ser mayor a 0"),
});

export const userFormSchema = z.object({
  email: z.email("Correo inválido"),
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["admin", "user"], "Rol inválido"),
});

export const tenderFormSchema = z.object({
  clientId: z.string().min(1, "Selecciona un cliente"),
  title: z.string().trim().min(1, "El título es obligatorio"),
  description: z.string().trim().optional(),
  maxBudget: z.coerce.number().positive("Debe ser mayor a 0"),
  deadline: z
    .string()
    .min(1, "La fecha límite es obligatoria")
    .refine((value) => new Date(value).getTime() > Date.now(), "Debe ser una fecha futura"),
});

export function cleanFormValues(
  values: Record<string, unknown>,
  rawKeys: string[] = ["password"],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      const cleaned = rawKeys.includes(key) ? value : value.trim();
      if (cleaned !== "") out[key] = cleaned;
    } else if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
