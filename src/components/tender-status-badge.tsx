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

const STATUS_CLASS: Record<TenderStatusValue, string> = {
  borrador: "",
  activa: "border-nebula-cyan/35 bg-nebula-cyan/15 text-nebula-cyan",
  finalizada: "border-nebula-lavender/35 bg-nebula-lavender/10 text-nebula-lavender",
  por_cobrar: "border-nebula-violet/35 bg-nebula-violet/15 text-nebula-lavender",
  cobrada: "border-nebula-cyan/35 bg-nebula-cyan/15 text-nebula-cyan",
  perdida: "border-destructive/35 bg-destructive/15 text-destructive",
};

export function TenderStatusBadge({
  status,
  className,
}: {
  status: TenderStatusValue;
  className?: string;
}) {
  return (
    <Badge
      variant={VARIANTS[status]}
      className={cn("font-mono tracking-wider uppercase", STATUS_CLASS[status], className)}
    >
      {TENDER_STATUS_LABELS[status]}
    </Badge>
  );
}
