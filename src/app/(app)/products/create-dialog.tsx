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
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { cleanFormValues, fieldErrors, productFormSchema } from "@/lib/forms";

const EMPTY = { name: "", sku: "", description: "", basePrice: "" };

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

export function ProductCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function update(key: keyof typeof EMPTY) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post("/api/products", cleanFormValues(parsed.data));
      toast.success("Producto creado");
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
          Nuevo producto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>
            Agrega un producto al catálogo para incluirlo en propuestas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="product-name" label="Nombre" error={errors.name}>
              <Input
                id="product-name"
                value={values.name}
                onChange={update("name")}
                aria-invalid={Boolean(errors.name)}
                autoFocus
              />
            </Field>
            <Field id="product-sku" label="SKU" error={errors.sku}>
              <Input
                id="product-sku"
                value={values.sku}
                onChange={update("sku")}
                placeholder="SKU-001"
                aria-invalid={Boolean(errors.sku)}
              />
            </Field>
            <Field id="product-price" label="Precio base ($)" error={errors.basePrice}>
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={values.basePrice}
                onChange={update("basePrice")}
                aria-invalid={Boolean(errors.basePrice)}
              />
            </Field>
          </div>
          <Field id="product-description" label="Descripción" error={errors.description}>
            <Textarea
              id="product-description"
              rows={3}
              value={values.description}
              onChange={update("description")}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="vv-shine-btn" disabled={pending}>
              {pending ? "Guardando…" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
