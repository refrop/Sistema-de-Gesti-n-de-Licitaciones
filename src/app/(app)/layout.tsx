import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Nav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <Nav user={user} />
      <main className="flex-1 cosmic-grid">{children}</main>
    </div>
  );
}
