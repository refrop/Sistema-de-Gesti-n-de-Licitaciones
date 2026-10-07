"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "./motion";

type SplitLinesProps = {
  lines: string[];
  className?: string;
  as?: "h1" | "h2" | "p" | "div";
  delay?: number;
  stagger?: number;
};

export function SplitLines({ lines, className, as = "h1", delay = 0.1, stagger = 0.12 }: SplitLinesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const Tag = as;

  useEffect(() => {
    if (prefersReducedMotion() || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-split-line]",
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.05, ease: "expo.out", stagger, delay },
      );
    }, ref);
    return () => ctx.revert();
  }, [delay, stagger]);

  return (
    <Tag ref={ref} className={className} aria-label={lines.join(" ")}>
      {lines.map((line) => (
        <span key={line} className="block overflow-hidden pb-[0.06em]" aria-hidden="true">
          <span data-split-line className="block will-change-transform">
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
