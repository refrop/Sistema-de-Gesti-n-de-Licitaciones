"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { cleanFormValues, fieldErrors, userFormSchema } from "@/lib/forms";

const EMPTY = { name: "", email: "", password: "", role: "user" };

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function UserCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function update(key: keyof typeof EMPTY) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = userFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post("/api/users", cleanFormValues(parsed.data));
      toast.success("Usuario creado");
      setOpen(false);
      setValues(EMPTY);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setErrors({});
      }}
    >
      <DialogTrigger asChild>
        <Button className="vv-shine-btn">
          <Plus />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Crea una cuenta con acceso al sistema. La contraseña se entrega al usuario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="user-name" label="Nombre" error={errors.name}>
              <Input
                id="user-name"
                value={values.name}
                onChange={update("name")}
                aria-invalid={Boolean(errors.name)}
                autoFocus
              />
            </Field>
            <Field id="user-email" label="Correo" error={errors.email}>
              <Input
                id="user-email"
                type="email"
                value={values.email}
                onChange={update("email")}
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field id="user-password" label="Contraseña" error={errors.password}>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={update("password")}
                aria-invalid={Boolean(errors.password)}
              />
            </Field>
            <Field id="user-role" label="Rol" error={errors.role}>
              <Select
                value={values.role}
                onValueChange={(role) => setValues((current) => ({ ...current, role }))}
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="vv-shine-btn" disabled={pending}>
              {pending ? "Guardando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
