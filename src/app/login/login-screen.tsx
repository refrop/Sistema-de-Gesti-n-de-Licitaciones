"use client";

import { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="dark login-fallback relative min-h-dvh overflow-hidden text-white">
      <NebulaField className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-14">
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

        <Card className="border-white/10 bg-white/[0.06] py-6 shadow-2xl shadow-black/40 ring-0 backdrop-blur-xl">
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
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {pending ? "Entrando…" : "Iniciar sesión"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-white/50">
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
