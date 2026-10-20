import type { CSSProperties } from "react";
import { RenderBlocks, Picture } from "@/components/blocks/render-blocks";
import type { PublishedEntry } from "@/lib/cms/public-data";
import type { RenderContext } from "@/lib/cms/render-context";
import { pageAttrs } from "@/lib/consent/tracking-config";

type PageVariables = CSSProperties & Record<`--custom-${string}`, string>;

export function IndependentPage({ entry, ctx }: { entry: PublishedEntry; ctx: RenderContext }) {
  const data = entry.data;
  const logo = typeof data.logoMediaId === "string" ? ctx.media.get(data.logoMediaId) : undefined;
  const style: PageVariables = {
    "--custom-bg": typeof data.pageBackground === "string" ? data.pageBackground : "#ffffff",
    "--custom-text": typeof data.pageText === "string" ? data.pageText : "#1e2b27",
    "--custom-accent": typeof data.pageAccent === "string" ? data.pageAccent : "#008d68",
    "--custom-button": typeof data.buttonBackground === "string" ? data.buttonBackground : "#008d68",
    "--custom-button-text": typeof data.buttonText === "string" ? data.buttonText : "#ffffff",
  };

  return (
    <main id="conteudo" className="independent-page flex-1" style={style} {...pageAttrs("landing")}>
      {logo ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-5">
          <div className="w-24"><Picture media={logo} sizes="96px" priority /></div>
        </div>
      ) : null}
      <RenderBlocks blocks={entry.blocks} ctx={ctx} />
    </main>
  );
}
