import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const encoder = new TextEncoder();

type Claims = { sub: string; role: string };

function redirectTo(req: NextRequest, pathname: string, search = ""): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

async function verifyToken(token: string): Promise<Claims | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return { sub: "", role: "" };
  try {
    const { payload } = await jwtVerify(token, encoder.encode(secret), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const onLogin = pathname === "/login";
  const claims = token ? await verifyToken(token) : null;

  if (!claims) {
    if (onLogin) return NextResponse.next();
    if (token) {
      const res = redirectTo(req, "/login");
      res.cookies.delete("session");
      return res;
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (onLogin) return NextResponse.redirect(new URL("/tenders", req.url));

  if (pathname.startsWith("/users") && claims.role !== "admin") {
    return redirectTo(req, "/tenders");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
