import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  consentModeSignals,
  parseConsent,
  safePath,
  serializeConsent,
  trackingCookieNames,
} from "@/lib/consent/consent";

const base = {
  version: CONSENT_VERSION,
  analytics: true,
  marketing: false,
  id: "3f2b6c1a-9d4e-4b8a-a1c2-0e9f8d7c6b5a",
  at: "2026-10-18T20:00:00.000Z",
};

describe("cookie de consentimento", () => {
  it("ida e volta", () => {
    expect(parseConsent(serializeConsent(base))).toEqual(base);
    expect(parseConsent(encodeURIComponent(serializeConsent(base)))).toEqual(base);
  });

  it("versão antiga, adulterada ou inválida vale como sem escolha", () => {
    expect(parseConsent(serializeConsent({ ...base, version: "2020-01-01" }))).toBeNull();
    expect(parseConsent("2026-10-18|1|1|nao-e-uuid|2026-10-18T20:00:00Z")).toBeNull();
    expect(parseConsent("2026-10-18|sim|1|3f2b6c1a-9d4e-4b8a-a1c2-0e9f8d7c6b5a|x")).toBeNull();
    expect(parseConsent("%E0%A4%A")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });
});

describe("Consent Mode v2", () => {
  it("tudo negado sem escolha", () => {
    expect(consentModeSignals(null)).toMatchObject({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("analytics sem marketing não libera sinais de anúncio", () => {
    expect(consentModeSignals({ analytics: true, marketing: false })).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });
});

describe("revogação", () => {
  const all = ["_ga", "_ga_ABC123", "_gid", "_fbp", "_fbc", "_gcl_au", "innovip_consent", "sb-token"];
  it("apaga só os cookies da categoria revogada e nunca os necessários", () => {
    expect(trackingCookieNames(all, { analytics: true, marketing: false })).toEqual(["_ga", "_ga_ABC123", "_gid"]);
    expect(trackingCookieNames(all, { analytics: false, marketing: true })).toEqual(["_fbp", "_fbc", "_gcl_au"]);
    expect(trackingCookieNames(all, { analytics: true, marketing: true })).not.toContain("innovip_consent");
  });
});

describe("caminho seguro", () => {
  it.each([
    ["/tratamentos/peeling?utm_source=x&email=a@b.com#top", "/tratamentos/peeling"],
    ["https://outro.site/x?y=1", "/x"],
    ["/Página com espaço", "/"],
    ["/promocoes/verao", "/promocoes/verao"],
  ])("%s → %s", (input, expected) => expect(safePath(input)).toBe(expected));
});
