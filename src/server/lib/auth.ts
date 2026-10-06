import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { env } from "./env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type Role = "admin" | "user";

export type SessionClaims = { sub: string; role: Role };

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const SESSION_COOKIE = "session";

export function sessionMaxAgeSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_EXPIRES_IN.trim());
  if (!match) throw new Error(`JWT_EXPIRES_IN inválido: ${env.JWT_EXPIRES_IN}`);
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2]];
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  };
}
