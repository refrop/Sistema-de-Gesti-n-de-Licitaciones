"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { toDateTimeLocalValue } from "@/lib/format";
import { cleanFormValues, fieldErrors, tenderFormSchema } from "@/lib/forms";

type ClientOption = { id: string; name: string };

export function TenderForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const now = useMemo(() => toDateTimeLocalValue(new Date()), []);
  const [values, setValues] = useState({
    clientId: clients[0]?.id ?? "",
    title: "",
    description: "",
    maxBudget: "",
    deadline: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function update(key: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = tenderFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.post("/api/tenders", cleanFormValues(parsed.data));
      toast.success("Licitación creada");
      router.push("/tenders");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border p-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="tender-client">Cliente</Label>
        <Select
          value={values.clientId}
          onValueChange={(clientId) => setValues((current) => ({ ...current, clientId }))}
        >
          <SelectTrigger id="tender-client" className="w-full" aria-invalid={Boolean(errors.clientId)}>
            <SelectValue placeholder="Selecciona un cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tender-title">Título</Label>
        <Input
          id="tender-title"
          value={values.title}
          onChange={update("title")}
          placeholder="Adquisición de equipos de cómputo"
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tender-budget">Presupuesto máximo ($)</Label>
          <Input
            id="tender-budget"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={values.maxBudget}
            onChange={update("maxBudget")}
            aria-invalid={Boolean(errors.maxBudget)}
          />
          {errors.maxBudget && <p className="text-xs text-destructive">{errors.maxBudget}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tender-deadline">Fecha límite</Label>
          <Input
            id="tender-deadline"
            type="datetime-local"
            min={now}
            value={values.deadline}
            onChange={update("deadline")}
            aria-invalid={Boolean(errors.deadline)}
          />
          {errors.deadline && <p className="text-xs text-destructive">{errors.deadline}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tender-description">Descripción</Label>
        <Textarea
          id="tender-description"
          rows={4}
          value={values.description}
          onChange={update("description")}
          placeholder="Alcance, requisitos y condiciones de la licitación…"
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/tenders")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Crear licitación"}
        </Button>
      </div>
    </form>
  );
}
