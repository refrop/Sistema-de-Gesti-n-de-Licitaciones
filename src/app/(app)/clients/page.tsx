import type { Metadata } from "next";
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
import { formatDate } from "@/lib/format";
import { listQuerySchema } from "@/server/lib/pagination";
import { listClients } from "@/server/services/clients.service";
import { ClientCreateDialog } from "./create-dialog";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = listQuerySchema.safeParse({ page: sp.page, pageSize: sp.pageSize, q: sp.q });
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});
  const clients = await listClients(query);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Clientes"
        description="Empresas y contactos asociados a las licitaciones."
        action={<ClientCreateDialog />}
      />

      <div className="mb-4">
        <SearchInput placeholder="Buscar por nombre o correo…" />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>RFC / taxId</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    title="Sin clientes"
                    hint={
                      query.q
                        ? "No hay resultados para esa búsqueda."
                        : "Crea tu primer cliente con el botón «Nuevo cliente»."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              clients.data.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.phone || "—"}</TableCell>
                  <TableCell>{client.contactName || "—"}</TableCell>
                  <TableCell>{client.taxId || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(client.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <PaginationBar page={clients.page} totalPages={clients.totalPages} total={clients.total} />
      </div>
    </div>
  );
}
