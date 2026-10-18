import { describe, expect, it } from "vitest";
import {
  centsToInput,
  formatCents,
  localInputToUtc,
  parseBrlToCents,
  utcToLocalInput,
} from "@/lib/cms/format";

describe("datas em America/Sao_Paulo", () => {
  it("converte horário local para UTC e volta", () => {
    const utc = localInputToUtc("2026-11-20T09:30");
    expect(utc).toBe("2026-11-20T12:30:00.000Z"); // UTC-3
    expect(utcToLocalInput(utc)).toBe("2026-11-20T09:30");
  });

  it("virada de dia em UTC", () => {
    expect(localInputToUtc("2026-12-31T23:00")).toBe("2027-01-01T02:00:00.000Z");
    expect(utcToLocalInput("2027-01-01T02:00:00Z")).toBe("2026-12-31T23:00");
  });

  it("entrada inválida", () => {
    expect(localInputToUtc("31/12/2026 23:00")).toBeUndefined();
    expect(utcToLocalInput("nao-e-data")).toBe("");
  });
});

describe("valores em centavos", () => {
  it.each([
    ["199,90", 19990],
    ["R$ 1.234,56", 123456],
    ["1234.5", 123450],
    ["1.500", 150000],
    ["0", 0],
  ])("%s → %d", (input, cents) => expect(parseBrlToCents(input)).toBe(cents));

  it("vazio e inválido", () => {
    expect(parseBrlToCents("  ")).toBeUndefined();
    expect(parseBrlToCents("12,345")).toBeNull();
    expect(parseBrlToCents("abc")).toBeNull();
    expect(parseBrlToCents("-10")).toBeNull();
  });

  it("formata", () => {
    expect(formatCents(19990).replace(/\s/g, " ")).toBe("R$ 199,90");
    expect(centsToInput(19990)).toBe("199,90");
  });
});
