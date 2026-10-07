import { cookies } from "next/headers";
import { db } from "@/server/lib/db";
import { verifySessionToken, SESSION_COOKIE } from "@/server/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
