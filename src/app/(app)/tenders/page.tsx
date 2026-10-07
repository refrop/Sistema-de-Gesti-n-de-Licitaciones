import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { SearchInput } from "@/components/search-input";
import { TenderStatusBadge } from "@/components/tender-status-badge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listClients } from "@/server/services/clients.service";
import { listTenders, tenderListQuerySchema } from "@/server/services/tenders.service";
import { TenderFilters } from "./filters";
import { ExpiringPanel } from "./expiring-panel";

export const metadata: Metadata = { title: "Licitaciones" };

export default async function TendersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = tenderListQuerySchema.safeParse({
    page: sp.page,
    pageSize: sp.pageSize,
    q: sp.q,
    status: sp.status,
    clientId: sp.clientId,
  });
  const query = parsed.success ? parsed.data : tenderListQuerySchema.parse({});
  const [tenders, clients] = await Promise.all([
    listTenders(query),
    listClients({ page: 1, pageSize: 100 }),
  ]);
  const hasFilters = Boolean(query.q || query.status || query.clientId);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Licitaciones"
        description="Procesos de licitación, propuestas y cobros."
        action={
          <Button asChild>
            <Link href="/tenders/new">
              <Plus />
              Nueva licitación
            </Link>
          </Button>
        }
      />

      <ExpiringPanel />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Buscar por título o descripción…" />
        <TenderFilters
          status={query.status}
          clientId={query.clientId}
          clients={clients.data}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenders.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="Sin licitaciones"
                    hint={
                      hasFilters
                        ? "No hay resultados para esos filtros."
                        : "Crea tu primera licitación con el botón «Nueva licitación»."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              tenders.data.map((tender) => (
                <TableRow key={tender.id}>
                  <TableCell className="font-medium">
                    <Link href={`/tenders/${tender.id}`} className="hover:underline">
                      {tender.title}
                    </Link>
                  </TableCell>
                  <TableCell>{tender.client.name}</TableCell>
                  <TableCell>{formatMoney(tender.maxBudget)}</TableCell>
                  <TableCell>
                    <TenderStatusBadge status={tender.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(tender.deadline)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(tender.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <PaginationBar
          page={tenders.page}
          totalPages={tenders.totalPages}
          total={tenders.total}
        />
      </div>
    </div>
  );
}
