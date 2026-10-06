import { Hono } from "hono";
import { timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env";
import { ensureBucket, uploadPdf } from "../../lib/storage";
import { sendEmail } from "../../lib/email";
import { DomainError } from "../../domain/errors";

// DESTINO temporal del spike (el remitente sin dominio verificado solo
// puede enviar al correo del dueño de la cuenta de Resend).
const SPIKE_TO = "refropg@gmail.com";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function buildMinimalPdf(): Buffer {
  const lines = [
    "BT /F1 20 Tf 72 720 Td (Spike Fase 1 - Sistema de Licitaciones) Tj ET",
    `BT /F1 12 Tf 72 690 Td (Generado: ${new Date().toISOString()}) Tj ET`,
    "BT /F1 12 Tf 72 660 Td (Este PDF se creo en memoria y se subio a Supabase Storage.) Tj ET",
  ];
  const content = lines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export const spikeRoutes = new Hono().get("/api/spike", async (c) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "CRON_SECRET inválido" } },
      401,
    );
  }

  const pdf = buildMinimalPdf();

  await ensureBucket();
  const objectPath = `spike/spike-${Date.now()}.pdf`;
  const { publicUrl } = await uploadPdf(objectPath, pdf);

  let emailId: string;
  try {
    emailId = await sendEmail({
      to: SPIKE_TO,
      subject: "[Spike] Correo con adjunto - Sistema de Licitaciones",
      html: [
        "<p>Spike de la Fase 1: este correo se envi&oacute; con un PDF generado en memoria.</p>",
        `<p>URL p&uacute;blica en Supabase Storage: <a href="${publicUrl}">${publicUrl}</a></p>`,
        `<p>Tama&ntilde;o del adjunto: ${pdf.length} bytes.</p>`,
      ].join(""),
      attachments: [{ filename: "spike.pdf", content: pdf }],
      idempotencyKey: `spike-${Date.now()}`,
    });
  } catch (e) {
    throw new DomainError(
      "EMAIL_FAILED",
      `Resend fall&oacute;: ${(e as Error).message}`,
      { url: publicUrl },
    );
  }

  return c.json({ url: publicUrl, emailId, bytes: pdf.length });
});
