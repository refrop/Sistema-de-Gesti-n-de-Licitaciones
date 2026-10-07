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
import { formatDate, formatMoney } from "@/lib/format";
import { listQuerySchema } from "@/server/lib/pagination";
import { listProducts } from "@/server/services/products.service";
import { ProductCreateDialog } from "./create-dialog";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const parsed = listQuerySchema.safeParse({ page: sp.page, pageSize: sp.pageSize, q: sp.q });
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});
  const products = await listProducts(query);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Productos"
        description="Catálogo de bienes y servicios ofertados en licitaciones."
        action={<ProductCreateDialog />}
      />

      <div className="mb-4">
        <SearchInput placeholder="Buscar por nombre o SKU…" />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Precio base</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title="Sin productos"
                    hint={
                      query.q
                        ? "No hay resultados para esa búsqueda."
                        : "Registra tu primer producto con el botón «Nuevo producto»."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              products.data.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                  <TableCell>{formatMoney(product.basePrice)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {product.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(product.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <PaginationBar page={products.page} totalPages={products.totalPages} total={products.total} />
      </div>
    </div>
  );
}
