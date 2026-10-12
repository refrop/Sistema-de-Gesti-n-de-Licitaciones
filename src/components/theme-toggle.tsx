"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={isLight ? "Modo oscuro" : "Modo claro"}
      className={cn("shrink-0", className)}
    >
      <span className="relative block size-4">
        <Sun
          aria-hidden="true"
          className={
            isLight
              ? "absolute inset-0 size-4 rotate-90 scale-0 opacity-0 transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              : "absolute inset-0 size-4 rotate-0 scale-100 opacity-100 transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          }
        />
        <Moon
          aria-hidden="true"
          className={
            isLight
              ? "absolute inset-0 size-4 rotate-0 scale-100 opacity-100 transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              : "absolute inset-0 size-4 -rotate-90 scale-0 opacity-0 transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          }
        />
      </span>
    </Button>
  );
}
