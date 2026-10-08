import { Resend } from "resend";
import { env } from "./env";
import { DomainError } from "../domain/errors";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
  idempotencyKey?: string;
}

export interface EmailProvider {
  readonly name: "resend" | "brevo";
  /** Envía el correo y devuelve el identificador en el proveedor (providerId). */
  send(message: EmailMessage): Promise<string>;
}

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

/** `"Nombre <correo>"` o correo simple → { name, email } para el campo sender de Brevo. */
function parseSender(from: string): { name?: string; email: string } {
  // Tolera comillas envolventes: EMAIL_FROM='"Nombre <correo>"'
  const raw = from.trim().replace(/^"([\s\S]*)"$/, "$1").trim();
  const angled = raw.match(/^(.*?)\s*<([^<>]+)>$/);
  if (angled) {
    const name = angled[1].replace(/^"|"$/g, "").trim();
    return { name: name || undefined, email: angled[2].trim() };
  }
  return { email: raw };
}

const resendProvider: EmailProvider = {
  name: "resend",
  async send(message) {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      throw new DomainError("EMAIL_FAILED", "Falta RESEND_API_KEY (EMAIL_PROVIDER=resend)");
    }
    const resend = new Resend(apiKey);
    const redirect = env.EMAIL_REDIRECT_TO;
    const redirectTo = redirect && redirect !== message.to ? redirect : undefined;

    const { data, error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: redirectTo ?? message.to,
        subject: message.subject,
        html: redirectTo ? redirectHtml(message.html, message.to) : message.html,
        ...(message.text ? { text: message.text } : {}),
        attachments: message.attachments,
      },
      message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
    );
    if (error) throw new Error(error.message);
    return data!.id;
  },
};

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

const brevoProvider: EmailProvider = {
  name: "brevo",
  async send(message) {
    const apiKey = env.BREVO_API_KEY;
    if (!apiKey) {
      throw new DomainError("EMAIL_FAILED", "Falta BREVO_API_KEY (EMAIL_PROVIDER=brevo)");
    }
    const sender = parseSender(env.EMAIL_FROM);
    if (!sender.email.includes("@")) {
      throw new DomainError("EMAIL_FAILED", `EMAIL_FROM no es un correo válido: "${env.EMAIL_FROM}"`);
    }

    const body: Record<string, unknown> = {
      sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    };
    if (message.text) body.textContent = message.text;
    if (message.attachments?.length) {
      body.attachment = message.attachments.map((attachment) => ({
        name: attachment.filename,
        content: attachment.content.toString("base64"),
      }));
    }

    let res: Response;
    try {
      res = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new DomainError(
        "EMAIL_FAILED",
        `Brevo no respondió: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const payload: unknown = await res.json().catch(() => null);
    const apiMessage =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { message?: unknown }).message === "string"
        ? `: ${(payload as { message: string }).message}`
        : "";
    if (!res.ok) {
      throw new DomainError("EMAIL_FAILED", `Brevo rechazó el envío (HTTP ${res.status})${apiMessage}`);
    }
    const messageId =
      payload && typeof payload === "object" ? (payload as { messageId?: unknown }).messageId : undefined;
    if (typeof messageId !== "string" || !messageId) {
      throw new DomainError("EMAIL_FAILED", "Brevo respondió sin messageId");
    }
    return messageId;
  },
};

const providers: Record<"resend" | "brevo", EmailProvider> = {
  resend: resendProvider,
  brevo: brevoProvider,
};

export function emailProvider(): EmailProvider {
  return providers[env.EMAIL_PROVIDER];
}

export async function sendEmail(opts: EmailMessage): Promise<string> {
  return emailProvider().send(opts);
}
