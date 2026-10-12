"use client";

import * as React from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "sisgest-theme";
const listeners = new Set<() => void>();

function readDom(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function getTheme(): Theme {
  return readDom();
}

export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* almacenamiento no disponible */
  }
  for (const listener of listeners) listener();
}

export function toggleTheme(): void {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = React.useSyncExternalStore(subscribeTheme, getTheme, () => "dark" as Theme);
  return { theme, setTheme, toggleTheme };
}
