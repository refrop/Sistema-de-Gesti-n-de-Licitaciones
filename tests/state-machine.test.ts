import { describe, it, expect } from "vitest";
import {
  TRANSITIONS,
  PRODUCT_EDITABLE,
  canTransition,
  isProductEditable,
} from "../src/server/domain/state-machine";

const STATUSES = [
  "borrador",
  "activa",
  "finalizada",
  "por_cobrar",
  "cobrada",
  "perdida",
] as const;

const ALLOWED: ReadonlyArray<[(typeof STATUSES)[number], (typeof STATUSES)[number]]> = [
  ["borrador", "activa"],
  ["activa", "finalizada"],
  ["activa", "perdida"],
  ["finalizada", "por_cobrar"],
  ["por_cobrar", "cobrada"],
];

describe("tabla de transiciones (6x6 pares)", () => {
  it("permite exactamente los 5 pares definidos y nada más", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const expected = ALLOWED.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("ningún estado transiciona a sí mismo", () => {
    for (const status of STATUSES) {
      expect(canTransition(status, status), status).toBe(false);
    }
  });

  it("cobrada y perdida son estados finales", () => {
    expect(TRANSITIONS.cobrada).toHaveLength(0);
    expect(TRANSITIONS.perdida).toHaveLength(0);
  });

  it("no se puede volver atrás (activa → borrador, cobrada → cualquier cosa)", () => {
    expect(canTransition("activa", "borrador")).toBe(false);
    for (const to of STATUSES) {
      expect(canTransition("cobrada", to), `cobrada → ${to}`).toBe(false);
      expect(canTransition("perdida", to), `perdida → ${to}`).toBe(false);
    }
  });
});

describe("edición de productos por estado", () => {
  it("editable solo en borrador y activa", () => {
    expect(PRODUCT_EDITABLE).toEqual(["borrador", "activa"]);
    expect(isProductEditable("borrador")).toBe(true);
    expect(isProductEditable("activa")).toBe(true);
    expect(isProductEditable("finalizada")).toBe(false);
    expect(isProductEditable("por_cobrar")).toBe(false);
    expect(isProductEditable("cobrada")).toBe(false);
    expect(isProductEditable("perdida")).toBe(false);
  });
});
