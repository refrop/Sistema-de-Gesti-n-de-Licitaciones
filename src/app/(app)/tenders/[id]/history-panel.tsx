import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TENDER_STATUS_LABELS, isTenderStatus } from "@/lib/tender-status";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { SerializedTender } from "@/lib/tender-serialize";

type UserBrief = { id: string; name: string };

function statusLabel(value: string | null): string {
  if (!value) return "—";
  return isTenderStatus(value) ? TENDER_STATUS_LABELS[value] : value;
}

function Empty({ text }: { text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

export function HistoryPanel({
  tender,
  users,
}: {
  tender: SerializedTender;
  users: UserBrief[];
}) {
  const names = new Map(users.map((user) => [user.id, user.name]));
  const who = (userId: string | null) =>
    userId ? (names.get(userId) ?? `${userId.slice(0, 8)}…`) : "—";

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Historial de estados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cambio</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.transitions.length === 0 ? (
                <Empty text="Sin cambios de estado" />
              ) : (
                tender.transitions
                  .slice()
                  .reverse()
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        {statusLabel(row.fromStatus)} → {statusLabel(row.toStatus)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                      <TableCell className="text-muted-foreground">{who(row.userId)}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.payments.length === 0 ? (
                <Empty text="Sin pagos registrados" />
              ) : (
                tender.payments
                  .slice()
                  .reverse()
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-muted-foreground">
                        {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(payment.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{payment.note ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Correos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Sin correos enviados
                  </TableCell>
                </TableRow>
              ) : (
                tender.emails
                  .slice()
                  .reverse()
                  .map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(email.createdAt)}
                      </TableCell>
                      <TableCell>{email.type}</TableCell>
                      <TableCell className="text-muted-foreground">{email.toEmail}</TableCell>
                      <TableCell>{email.status}</TableCell>
                      <TableCell className="max-w-md truncate text-muted-foreground">
                        {email.error ?? email.providerId ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
