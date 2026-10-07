"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "cn";
import { prefersReducedMotion } from "./motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function RevealOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (prefersReducedMotion() || !el) return;
    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: 0,
        opacity: 1,
        duration: 0.85,
        ease: "expo.out",
        delay,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
    return () => ctx.revert();
  }, [delay]);

  return (
    <div ref={ref} className={cn("reveal-on-scroll", className)}>
      {children}
    </div>
  );
}

export function Divider({ className, delay = 0 }: { className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (prefersReducedMotion() || !el) return;
    const ctx = gsap.context(() => {
      gsap.to(el, {
        scaleX: 1,
        duration: 1.1,
        ease: "expo.out",
        delay,
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      });
    });
    return () => ctx.revert();
  }, [delay]);

  return <div ref={ref} role="separator" className={cn("divider-anim", className)} />;
}
