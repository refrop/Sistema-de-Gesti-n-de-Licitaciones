"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { isProductEditable } from "@/server/domain/state-machine";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { addCents, centsToAmount, toCents } from "@/lib/money";
import type { SerializedTender } from "@/lib/tender-serialize";

type ProductOption = { id: string; name: string; sku: string; basePrice: string };

export function ProductsPanel({
  tender,
  options,
}: {
  tender: SerializedTender;
  options: ProductOption[];
}) {
  const router = useRouter();
  const editable = isProductEditable(tender.status);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const maxBudgetCents = toCents(tender.maxBudget);
  const currentCents = useMemo(
    () => tender.products.reduce((sum, line) => sum + toCents(line.subtotal), 0),
    [tender.products],
  );
  const remainingCents = maxBudgetCents - currentCents;
  const selected = options.find((option) => option.id === productId);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  const projectedCents = useMemo(() => {
    if (!selected) return currentCents;
    const existing = tender.products.find((line) => line.productId === selected.id);
    const without = currentCents - (existing ? toCents(existing.subtotal) : 0);
    return addCents(without, toCents(selected.basePrice), qty);
  }, [selected, currentCents, qty, tender.products]);
  const overBudget = projectedCents > maxBudgetCents;

  async function add() {
    if (!selected) {
      setError("Selecciona un producto");
      return;
    }
    if (overBudget) {
      setError(
        `Supera el presupuesto máximo (disponible ${formatMoney(centsToAmount(remainingCents))})`,
      );
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post(`/api/tenders/${tender.id}/products`, { productId: selected.id, quantity: qty });
      toast.success("Producto agregado");
      setProductId("");
      setQuantity("1");
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function remove(lineProductId: string) {
    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/tenders/${tender.id}/products/${lineProductId}`);
      toast.success("Producto quitado");
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Productos</CardTitle>
        <span className="text-sm text-muted-foreground">
          Disponible {formatMoney(centsToAmount(remainingCents))} de{" "}
          {formatMoney(tender.maxBudget)}
        </span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      title="Sin productos"
                      hint={
                        editable
                          ? "Agrega productos desde la fila inferior."
                          : "La licitación ya no admite cambios de productos."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                tender.products.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <span className="font-medium">{line.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{line.sku}</span>
                    </TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(line.subtotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar ${line.name}`}
                          disabled={pending}
                          onClick={() => remove(line.productId)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total productos</TableCell>
                <TableCell className="text-right">{formatMoney(tender.totalProducts)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {editable && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="product-select">Producto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product-select" className="w-full" aria-label="Producto">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name} ({option.sku}) · {formatMoney(option.basePrice)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="product-qty">Cantidad</Label>
              <Input
                id="product-qty"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Plus />
              Agregar
            </Button>
          </form>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {overBudget && !error && (
          <p className="mt-3 text-sm text-destructive">
            Supera el presupuesto máximo (disponible {formatMoney(centsToAmount(remainingCents))})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
