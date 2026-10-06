import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
  idempotencyKey?: string;
}): Promise<string> {
  const { data, error } = await resend.emails.send(
    {
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments,
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
  if (error) throw new Error(error.message);
  return data!.id;
}
