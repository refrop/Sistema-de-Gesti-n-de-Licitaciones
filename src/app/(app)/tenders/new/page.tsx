import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { cn } from "cn";
import { listClients } from "@/server/services/clients.service";
import { TenderForm } from "./tender-form";

export const metadata: Metadata = { title: "Nueva licitación" };

export default async function NewTenderPage() {
  const clients = await listClients({ page: 1, pageSize: 100 });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Nueva licitación"
        description="Registra el proceso para asociar productos, propuesta y cobros."
        action={
          <Link href="/tenders" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft />
            Volver
          </Link>
        }
      />

      {clients.data.length === 0 ? (
        <div className="rounded-lg border">
          <EmptyState
            title="Necesitas un cliente"
            hint="Crea al menos un cliente antes de registrar una licitación."
            action={
              <Link href="/clients" className={cn(buttonVariants({ size: "sm" }))}>
                Ir a clientes
              </Link>
            }
          />
        </div>
      ) : (
        <TenderForm clients={clients.data} />
      )}
    </div>
  );
}
