"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { fieldErrors, loginSchema } from "@/lib/forms";
import { NebulaField } from "@/components/atmos/nebula-field";
import { Divider } from "@/components/atmos/reveal";
import { SplitLines } from "@/components/atmos/split-lines";

export function LoginScreen({ next }: { next: string }) {
  const router = useRouter();
  const screenRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function playExit(): Promise<void> {
    const screen = screenRef.current;
    const card = cardRef.current;
    if (!screen || !card) return Promise.resolve();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
    return import("gsap")
      .then(({ gsap }) => {
        return new Promise<void>((resolve) => {
          const top = topRef.current;
          const hint = hintRef.current;
          const tl = gsap.timeline({ onComplete: () => resolve() });
          if (top) {
            tl.to(top.children, { opacity: 0, duration: 0.32, ease: "power2.out", stagger: 0.05 }, 0);
          }
          if (hint) {
            tl.to(hint, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0.12);
          }
          tl.to(
            card,
            {
              y: () => -(card.getBoundingClientRect().bottom + 32),
              duration: 0.95,
              ease: "power3.inOut",
            },
            0.5,
          ).to(screen, { opacity: 0, duration: 0.5, ease: "power1.out" }, 1.35);
        });
      })
      .catch(() => undefined);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post<{ user: { id: string } }>("/api/auth/login", parsed.data);
      toast.success("Sesión iniciada");
      await playExit();
      router.replace(next);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(false);
    }
  }

  function fillDemo() {
    setEmail("admin@example.com");
    setPassword("CambiaEstaClave123!");
    setErrors({});
  }

  return (
    <div
      ref={screenRef}
      className="dark login-fallback relative min-h-dvh overflow-hidden text-white"
    >
      <NebulaField className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-14">
        <div ref={topRef} data-login-top>
          <p className="mb-3 text-xs font-medium tracking-[0.32em] text-white/50 uppercase">
            Sistema de gestión
          </p>
          <SplitLines
            lines={["Toda tu licitación", "en un solo lugar"]}
            className="font-heading text-4xl leading-[1.05] font-medium tracking-tight sm:text-5xl"
            delay={0.25}
          />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Clientes, productos, propuestas y cobros con control total sobre cada etapa del proceso.
          </p>
          <Divider className="mt-7 mb-7 h-px bg-white/20" delay={0.6} />
        </div>

        <div ref={cardRef} data-login-card>
          <Card
            className="vv-shimmer-btn border-border bg-card/70 py-6 shadow-2xl shadow-black/50 ring-0 backdrop-blur-xl"
            data-shimmer-colors="221,183,255;183,109,255;123,208,255"
          >
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(errors.password)}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full vv-shine-btn" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {pending ? "Entrando…" : "Iniciar sesión"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <p ref={hintRef} data-login-hint className="mt-4 text-center text-xs text-white/50">
          ¿Probando?{" "}
          <button
            type="button"
            onClick={fillDemo}
            className="font-medium text-white/80 underline underline-offset-4 transition-colors hover:text-white"
          >
            Usar credenciales demo
          </button>
        </p>
      </main>
    </div>
  );
}
