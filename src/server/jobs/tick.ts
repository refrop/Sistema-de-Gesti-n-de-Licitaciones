import { expireTenders } from "./expire-tenders";
import { sendReminders } from "./send-reminders";

export type TickResult = {
  expired: number;
  reminded: number;
  errors: string[];
  time: string;
};

export async function runTick(now = new Date()): Promise<TickResult> {
  // Primero vencer (así no se recuerda una licitación ya vencida)
  const expiry = await expireTenders(now);
  const reminders = await sendReminders(now);
  return {
    expired: expiry.count,
    reminded: reminders.count,
    errors: [...expiry.errors, ...reminders.errors],
    time: now.toISOString(),
  };
}
