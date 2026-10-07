import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { transition } from "../services/tender.service";

export type JobResult = { count: number; errors: string[] };

export async function expireTenders(now = new Date()): Promise<JobResult> {
  const due = await db.tender.findMany({
    where: { status: "activa", deadline: { lt: now } },
    select: { id: true },
    take: 50,
  });

  let count = 0;
  const errors: string[] = [];
  for (const { id } of due) {
    try {
      await db.$transaction((tx) =>
        transition(tx, id, "perdida", null, "vencimiento_automatico"),
      );
      count++;
    } catch (err) {
      // Si otro proceso ya la cambió, transition() lanza INVALID_TRANSITION: no es error
      if (err instanceof DomainError && err.code === "INVALID_TRANSITION") continue;
      errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { count, errors };
}
