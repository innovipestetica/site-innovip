import { describe, expect, it } from "vitest";
import { safeAdminPath } from "@/lib/security/redirect";

describe("safeAdminPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/redefinir-senha", "/admin/redefinir-senha"],
    ["/admin/leads?status=novo#x", "/admin/leads"],
  ])("aceita caminho interno do painel %s", (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "https://malicioso.com/admin",
    "//malicioso.com/admin",
    "/\\malicioso.com",
    "\\\\malicioso.com",
    "javascript:alert(1)",
    "/admin\u0000",
    "/administrador-falso",
    "/",
    "/tratamentos",
    "/admin/../tratamentos",
    `/admin/${"a".repeat(600)}`,
  ])("rejeita %s", (input) => {
    expect(safeAdminPath(input)).toBe("/admin");
  });

  it("usa o fallback informado", () => {
    expect(safeAdminPath("https://x.com", "/admin/login")).toBe("/admin/login");
  });
});
