import { db } from "../lib/db";
import { env } from "../lib/env";
import { sendEmail } from "../lib/email";
import { buildReminderHtml } from "../lib/mail-templates";
import type { JobResult } from "./expire-tenders";

export async function sendReminders(now = new Date()): Promise<JobResult> {
  const limit = new Date(now.getTime() + env.REMINDER_HOURS * 3_600_000);
  const candidates = await db.tender.findMany({
    where: {
      status: "activa",
      deadline: { gt: now, lte: limit },
      reminderSentAt: null,
    },
    include: { client: true, products: { include: { product: true } } },
    take: 50,
  });

  let count = 0;
  const errors: string[] = [];
  for (const tender of candidates) {
    // Reclamo atómico: solo un proceso gana (y si se venció entre medias, no recuerda)
    const claim = await db.tender.updateMany({
      where: { id: tender.id, reminderSentAt: null, status: "activa" },
      data: { reminderSentAt: now },
    });
    if (claim.count === 0) continue;

    try {
      const hoursLeft = Math.max(
        1,
        Math.floor((tender.deadline.getTime() - now.getTime()) / 3_600_000),
      );
      const providerId = await sendEmail({
        to: tender.client.email,
        subject: `Recordatorio: "${tender.title}" vence en ${hoursLeft} h`,
        html: buildReminderHtml(tender, hoursLeft),
        idempotencyKey: `tender-${tender.id}-recordatorio`,
      });
      await db.emailLog.create({
        data: {
          tenderId: tender.id,
          type: "recordatorio",
          toEmail: tender.client.email,
          providerId,
          status: "enviado",
        },
      });
      count++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Revertir el reclamo para reintentar en el próximo tick
      await db.tender.update({
        where: { id: tender.id },
        data: { reminderSentAt: null },
      });
      await db.emailLog.create({
        data: {
          tenderId: tender.id,
          type: "recordatorio",
          toEmail: tender.client.email,
          status: "fallido",
          error: message.slice(0, 1000),
        },
      });
      errors.push(`${tender.id}: ${message}`);
    }
  }
  return { count, errors };
}
