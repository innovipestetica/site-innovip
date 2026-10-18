import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/validation/password";

describe("passwordProblem", () => {
  it("aceita frase longa", () => {
    expect(passwordProblem("lotus verde no jardim da clinica")).toBeNull();
  });

  it("rejeita senha curta", () => {
    expect(passwordProblem("curta123")).toMatch(/12 caracteres/);
  });

  it("rejeita mais de 72 bytes (limite do bcrypt)", () => {
    expect(passwordProblem("á".repeat(40))).toMatch(/72/);
  });

  it("rejeita caractere repetido", () => {
    expect(passwordProblem("aaaaaaaaaaaaaa")).not.toBeNull();
  });
});
