import { describe, it, expect } from "vitest";
import { addCents, centsToAmount, toCents } from "../src/lib/money";

describe("toCents", () => {
  it("parsea decimales con punto", () => {
    expect(toCents("15000.75")).toBe(1500075);
    expect(toCents(10.5)).toBe(1050);
  });

  it("parsea formato es-PE (miles con punto, decimal con coma)", () => {
    expect(toCents("1.500,75")).toBe(150075);
    expect(toCents("15.000,75")).toBe(1500075);
  });

  it("parsea formato con coma de miles", () => {
    expect(toCents("1,500.75")).toBe(150075);
    expect(toCents("15,000.75")).toBe(1500075);
  });

  it("ignora símbolos y espacios", () => {
    expect(toCents("$1 234,50")).toBe(123450);
    expect(toCents("USD 99.90")).toBe(9990);
  });

  it("devuelve 0 en vacíos y nulos", () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
  });

  it("conserva el signo negativo", () => {
    expect(toCents("-10.5")).toBe(-1050);
  });
});

describe("addCents / centsToAmount", () => {
  it("suma exacta sin error de punto flotante", () => {
    expect(addCents(toCents("0.1"), toCents("0.2"), 1)).toBe(30);
    expect(addCents(100, 1050, 3)).toBe(3250);
  });

  it("convierte centavos a monto con dos decimales", () => {
    expect(centsToAmount(1000075)).toBe(10000.75);
    expect(centsToAmount(30)).toBe(0.3);
  });
});
