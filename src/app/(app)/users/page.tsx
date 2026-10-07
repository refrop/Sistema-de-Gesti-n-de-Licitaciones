import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import { getSessionUser } from "@/lib/session";
import { listQuerySchema } from "@/server/lib/pagination";
import { listUsers } from "@/server/services/users.service";
import { UserCreateDialog } from "./create-dialog";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionUser();
  if (session?.role !== "admin") notFound();

  const sp = await searchParams;
  const parsed = listQuerySchema.safeParse({ page: sp.page, pageSize: sp.pageSize, q: sp.q });
  const query = parsed.success ? parsed.data : listQuerySchema.parse({});
  const users = await listUsers(query);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Usuarios"
        description="Cuentas con acceso al sistema y sus roles."
        action={<UserCreateDialog />}
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
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title="Sin usuarios"
                    hint={
                      query.q
                        ? "No hay resultados para esa búsqueda."
                        : "Registra tu primer usuario con el botón «Nuevo usuario»."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Administrador" : "Usuario"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "outline" : "destructive"}>
                      {user.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <PaginationBar page={users.page} totalPages={users.totalPages} total={users.total} />
      </div>
    </div>
  );
}
