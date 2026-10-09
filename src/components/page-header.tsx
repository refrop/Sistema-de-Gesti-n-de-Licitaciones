"use client";

import { Divider, RevealOnScroll } from "@/components/atmos/reveal";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <RevealOnScroll className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-nebula-gradient inline-block font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      <Divider className="mt-5 h-px bg-border" />
    </RevealOnScroll>
  );
}
