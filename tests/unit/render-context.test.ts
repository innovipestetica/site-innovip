import { describe, expect, it } from "vitest";
import { collectRefs } from "@/lib/cms/render-context";

describe("collectRefs", () => {
  it("coleta referências com prefixos usados por blocos personalizados", () => {
    const refs = collectRefs({
      carouselMediaIds: ["imagem-1", "imagem-2"],
      iconMediaId: "icone-1",
      promotionEntryId: "conteudo-1",
    });

    expect([...refs.media]).toEqual(["imagem-1", "imagem-2", "icone-1"]);
    expect([...refs.entries]).toEqual(["conteudo-1"]);
  });
});
