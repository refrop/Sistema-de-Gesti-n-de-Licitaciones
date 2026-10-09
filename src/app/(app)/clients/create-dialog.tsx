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
import { api, errorMessage } from "@/lib/api";
import { cleanFormValues, clientFormSchema, fieldErrors } from "@/lib/forms";

const EMPTY = { name: "", email: "", phone: "", taxId: "", contactName: "" };

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

export function ClientCreateDialog() {
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
    const parsed = clientFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post("/api/clients", cleanFormValues(parsed.data));
      toast.success("Cliente creado");
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
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            Registra un cliente para poder asociarlo a licitaciones.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="client-name" label="Nombre" error={errors.name}>
              <Input
                id="client-name"
                value={values.name}
                onChange={update("name")}
                aria-invalid={Boolean(errors.name)}
                autoFocus
              />
            </Field>
            <Field id="client-email" label="Correo" error={errors.email}>
              <Input
                id="client-email"
                type="email"
                value={values.email}
                onChange={update("email")}
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field id="client-phone" label="Teléfono" error={errors.phone}>
              <Input id="client-phone" value={values.phone} onChange={update("phone")} />
            </Field>
            <Field id="client-tax" label="RFC / taxId" error={errors.taxId}>
              <Input id="client-tax" value={values.taxId} onChange={update("taxId")} />
            </Field>
            <Field id="client-contact" label="Contacto" error={errors.contactName}>
              <Input
                id="client-contact"
                value={values.contactName}
                onChange={update("contactName")}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="vv-shine-btn" disabled={pending}>
              {pending ? "Guardando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
