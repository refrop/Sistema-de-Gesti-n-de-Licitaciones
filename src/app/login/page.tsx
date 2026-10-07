import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/tenders");

  const params = await searchParams;
  const raw = params.next ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/tenders";

  return <LoginScreen next={next} />;
}
