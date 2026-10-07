"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import type { SessionUser } from "@/lib/session";

const LINKS = [
  { href: "/tenders", label: "Licitaciones" },
  { href: "/clients", label: "Clientes" },
  { href: "/products", label: "Productos" },
  { href: "/users", label: "Usuarios", adminOnly: true },
];

export function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      toast.error(errorMessage(error));
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/tenders"
          className="font-heading text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          SisGest
        </Link>
        <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.filter((link) => !link.adminOnly || user.role === "admin").map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">
              {user.role === "admin" ? "Administrador" : "Usuario"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Cerrar sesión">
            <LogOut />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
