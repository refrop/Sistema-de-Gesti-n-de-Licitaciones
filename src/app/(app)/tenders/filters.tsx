"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TENDER_STATUSES, TENDER_STATUS_LABELS } from "@/lib/tender-status";

const ALL = "all";

export function TenderFilters({
  status,
  clientId,
  clients,
}: {
  status?: string;
  clientId?: string;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: "status" | "clientId", value: string) {
    const qs = new URLSearchParams(params.toString());
    if (!value || value === ALL) qs.delete(key);
    else qs.set(key, value);
    qs.delete("page");
    const search = qs.toString();
    router.replace(search ? `${pathname}?${search}` : pathname);
  }

  return (
    <>
      <Select value={status || ALL} onValueChange={(value) => update("status", value)}>
        <SelectTrigger className="w-44" aria-label="Filtrar por estado">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {TENDER_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {TENDER_STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={clientId || ALL} onValueChange={(value) => update("clientId", value)}>
        <SelectTrigger className="w-56" aria-label="Filtrar por cliente">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los clientes</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
