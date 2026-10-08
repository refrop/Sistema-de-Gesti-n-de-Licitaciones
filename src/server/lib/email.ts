import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.RESEND_API_KEY);

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

// Sin dominio verificado, Resend solo acepta enviar al titular de la cuenta.
// Si EMAIL_REDIRECT_TO está definido, el correo va al titular y el destinatario
// original queda visible en el cuerpo (EmailLog sigue registrando el original).
function redirectHtml(html: string, original: string): string {
  return [
    '<div style="font-family:sans-serif;font-size:12px;color:#555;',
    'border-bottom:1px solid #ddd;padding:8px 12px">',
    `<p style="margin:0"><strong>Destinatario original:</strong> ${escapeHtml(original)}</p>`,
    '<p style="margin:4px 0 0">Redirigido al correo del titular de la cuenta de Resend',
    " (dominio sin verificar).</p>",
    "</div>",
    html,
  ].join("");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
  idempotencyKey?: string;
}): Promise<string> {
  const redirect = env.EMAIL_REDIRECT_TO;
  const redirectTo = redirect && redirect !== opts.to ? redirect : undefined;

  const { data, error } = await resend.emails.send(
    {
      from: env.EMAIL_FROM,
      to: redirectTo ?? opts.to,
      subject: opts.subject,
      html: redirectTo ? redirectHtml(opts.html, opts.to) : opts.html,
      attachments: opts.attachments,
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
  if (error) throw new Error(error.message);
  return data!.id;
}
