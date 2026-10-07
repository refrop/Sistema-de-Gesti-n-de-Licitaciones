import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  TENDER_STATUS_LABELS,
  type TenderStatusValue,
} from "@/lib/tender-status";

const VARIANTS: Record<
  TenderStatusValue,
  "default" | "secondary" | "outline" | "destructive"
> = {
  borrador: "secondary",
  activa: "default",
  finalizada: "outline",
  por_cobrar: "outline",
  cobrada: "secondary",
  perdida: "destructive",
};

export function TenderStatusBadge({
  status,
  className,
}: {
  status: TenderStatusValue;
  className?: string;
}) {
  return (
    <Badge variant={VARIANTS[status]} className={cn(className)}>
      {TENDER_STATUS_LABELS[status]}
    </Badge>
  );
}
