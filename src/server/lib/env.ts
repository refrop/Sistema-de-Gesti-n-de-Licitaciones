import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL es obligatoria"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().min(1, "JWT_EXPIRES_IN es obligatoria"),
  SEED_ADMIN_EMAIL: z.email("SEED_ADMIN_EMAIL debe ser un correo válido"),
  SEED_ADMIN_PASSWORD: z.string().min(8, "SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres"),
  SUPABASE_URL: z.url("SUPABASE_URL debe ser una URL válida"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY es obligatoria"),
  SUPABASE_BUCKET: z.string().min(1, "SUPABASE_BUCKET es obligatoria"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY es obligatoria"),
  EMAIL_FROM: z.string().min(1, "EMAIL_FROM es obligatoria"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET debe tener al menos 16 caracteres"),
  REMINDER_HOURS: z.coerce.number().int().positive("REMINDER_HOURS debe ser un entero positivo"),
  APP_URL: z.url("APP_URL debe ser una URL válida"),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas o faltantes:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
