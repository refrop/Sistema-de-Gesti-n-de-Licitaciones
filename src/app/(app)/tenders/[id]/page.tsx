import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DomainError } from "@/server/domain/errors";
import { listProducts } from "@/server/services/products.service";
import { getTender } from "@/server/services/tenders.service";
import { serializeTender, type SerializedTender } from "@/lib/tender-serialize";
import { ActionsPanel } from "./actions-panel";
import { DetailHeader } from "./detail-header";
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <DetailHeader tender={tender} />
      <Totals tender={tender} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductsPanel tender={tender} options={options} />
        </div>
        <ActionsPanel tender={tender} />
      </div>
    </div>
  );
}
