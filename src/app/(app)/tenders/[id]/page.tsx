import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DomainError } from "@/server/domain/errors";
import { listProducts } from "@/server/services/products.service";
import { getTender } from "@/server/services/tenders.service";
import { listUsersBrief } from "@/server/services/users.service";
import { serializeTender, type SerializedTender } from "@/lib/tender-serialize";
import { ActionsPanel } from "./actions-panel";
import { CyclePanel } from "./cycle-panel";
import { DetailHeader } from "./detail-header";
import { HistoryPanel } from "./history-panel";
import { ProductsPanel } from "./products-panel";
import { Totals } from "./totals";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const tender = await getTender(id);
    return { title: tender.title };
  } catch {
    return { title: "Licitación" };
  }
}

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let tender: SerializedTender;
  try {
    tender = serializeTender(await getTender(id));
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const products = await listProducts({ page: 1, pageSize: 100 });
  const options = products.data.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    basePrice: String(product.basePrice),
  }));
  const users = await listUsersBrief();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <DetailHeader tender={tender} />
      <Totals tender={tender} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProductsPanel tender={tender} options={options} />
          <HistoryPanel tender={tender} users={users} />
        </div>
        <div className="space-y-6">
          <ActionsPanel tender={tender} />
          <CyclePanel tender={tender} />
        </div>
      </div>
    </div>
  );
}
