import { NextResponse } from "next/server";
import sharp from "sharp";
import { getMedia, getRedirect } from "@/lib/cms/public-data";

export async function GET() {
  try {
    const redirect = await getRedirect("/grupovip");
    const media = await getMedia(redirect?.previewMediaId);
    const source = media?.sources.at(-1)?.url;
    if (!source) return new NextResponse(null, { status: 404 });

    const response = await fetch(source, { cache: "force-cache" });
    if (!response.ok) return new NextResponse(null, { status: 502 });
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();

    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagem indisponível." }, { status: 500 });
  }
}
