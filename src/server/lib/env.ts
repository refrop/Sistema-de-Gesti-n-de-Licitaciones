import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL es obligatoria"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
    JWT_EXPIRES_IN: z.string().min(1, "JWT_EXPIRES_IN es obligatoria"),
    SEED_ADMIN_EMAIL: z.email("SEED_ADMIN_EMAIL debe ser un correo válido"),
    SEED_ADMIN_PASSWORD: z.string().min(8, "SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres"),
    SUPABASE_URL: z.url("SUPABASE_URL debe ser una URL válida"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY es obligatoria"),
    SUPABASE_BUCKET: z.string().min(1, "SUPABASE_BUCKET es obligatoria"),
    EMAIL_PROVIDER: z.enum(["resend", "brevo"]).default("resend"),
    RESEND_API_KEY: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(1, "EMAIL_FROM es obligatoria"),
    EMAIL_REDIRECT_TO: z
      .union([z.email("EMAIL_REDIRECT_TO debe ser un correo válido"), z.literal("")])
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    CRON_SECRET: z.string().min(16, "CRON_SECRET debe tener al menos 16 caracteres"),
    REMINDER_HOURS: z.coerce.number().int().positive("REMINDER_HOURS debe ser un entero positivo"),
    APP_URL: z.url("APP_URL debe ser una URL válida"),
  })
  .superRefine((value, ctx) => {
    // La API key del proveedor elegido es obligatoria: falla claro al arrancar.
    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY es obligatoria cuando EMAIL_PROVIDER=resend",
      });
    }
    if (value.EMAIL_PROVIDER === "brevo" && !value.BREVO_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["BREVO_API_KEY"],
        message: "BREVO_API_KEY es obligatoria cuando EMAIL_PROVIDER=brevo",
      });
    }
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
