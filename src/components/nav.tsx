"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gavel, LogOut, Package, Users, UsersRound } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import type { SessionUser } from "@/lib/session";

const LINKS = [
  { href: "/tenders", label: "Licitaciones", icon: Gavel },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/users", label: "Usuarios", adminOnly: true, icon: UsersRound },
];

type Box = { x: number; y: number; w: number; h: number };

export function Nav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const linkRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});
  const measureRef = React.useRef<() => void>(() => {});
  const readyRef = React.useRef(false);
  const [box, setBox] = React.useState<Box | null>(null);
  const [ready, setReady] = React.useState(false);

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

  function measure() {
    const active = LINKS.find(
      (l) =>
        (!l.adminOnly || user.role === "admin") &&
        (pathname === l.href || pathname.startsWith(`${l.href}/`)),
    );
    const el = active ? linkRefs.current[active.href] : null;
    if (!el) return;
    const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    setBox((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next,
    );
    if (!readyRef.current) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          readyRef.current = true;
          setReady(true);
        }),
      );
    }
  }

  React.useLayoutEffect(() => {
    measureRef.current = measure;
  });

  React.useLayoutEffect(() => {
    measure();
  });

  React.useEffect(() => {
    const onResize = () => measureRef.current();
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => measureRef.current());
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-sidebar/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link
          href="/tenders"
          className="font-heading text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          <span className="text-white">Sis</span>
          <span className="text-nebula-lavender">Gest</span>
        </Link>
        <nav className="relative -mx-1 flex flex-1 items-center gap-1 overflow-x-auto">
          {box && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-0 left-0 rounded-lg border border-nebula-violet/35 bg-nebula-violet/15 shadow-[0_0_18px_-6px_rgba(183,109,255,0.55)]",
                ready && "nav-tab-indicator",
              )}
              style={{
                width: box.w,
                height: box.h,
                transform: `translate(${box.x}px, ${box.y}px)`,
              }}
            />
          )}
          {LINKS.filter((link) => !link.adminOnly || user.role === "admin").map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                ref={(el) => {
                  linkRefs.current[link.href] = el;
                }}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "nav-tab relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "font-semibold text-white"
                    : "text-secondary-foreground hover:bg-accent hover:text-white",
                )}
              >
                <Icon aria-hidden="true" className="nav-tab-icon size-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="font-mono text-[10px] tracking-wider text-nebula-lavender/80 uppercase">
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
