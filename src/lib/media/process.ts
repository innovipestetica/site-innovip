import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";

/**
 * Validação e processamento de imagens enviadas ao painel.
 * - Confere a ASSINATURA real do arquivo (bytes iniciais), não a extensão
 *   nem o Content-Type declarado: arquivo disfarçado é recusado.
 * - Aceita só JPEG, PNG, WebP e AVIF. SVG, HTML, executáveis: recusados.
 * - Limita dimensões/pixels (evita "bombas" de descompressão).
 * - Remove EXIF/XMP/ICC desnecessários (inclusive GPS) aplicando a rotação.
 * - Gera variantes WebP otimizadas para srcset.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_DIMENSION = 12000;
export const MAX_PIXELS = 50_000_000;
export const VARIANT_WIDTHS = [480, 960, 1600] as const;

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif"; ext: "jpg" | "png" | "webp" | "avif" };

const ALLOWED: Record<string, ImageKind> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
  avif: { mime: "image/avif", ext: "avif" },
};

export const ALLOWED_MIMES = Object.values(ALLOWED).map((k) => k.mime);

export function extForMime(mime: string): ImageKind["ext"] | null {
  return Object.values(ALLOWED).find((k) => k.mime === mime)?.ext ?? null;
}

/** Identifica o formato pelos bytes iniciais (magic numbers). */
export function detectImageType(buf: Uint8Array): ImageKind | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...buf.subarray(start, end));
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ALLOWED.jpeg!;
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return ALLOWED.png!;
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return ALLOWED.webp!;
  if (buf.length >= 12 && ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return ALLOWED.avif!;
  return null;
}

export class MediaValidationError extends Error {}

export type ProcessedImage = {
  kind: ImageKind;
  width: number;
  height: number;
  sha256: string;
  /** Original reencodado sem metadados (mesmo formato). */
  original: Buffer;
  variants: { width: number; height: number; buffer: Buffer }[];
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) {
    throw new MediaValidationError("Arquivo vazio ou maior que 10 MB.");
  }
  const kind = detectImageType(input);
  if (!kind) {
    throw new MediaValidationError("Formato não aceito. Envie JPEG, PNG, WebP ou AVIF (SVG e outros tipos são recusados).");
  }

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new MediaValidationError("Imagem corrompida ou não reconhecida.");
  }
  const decoded = meta.format === "heif" ? "avif" : meta.format;
  if (!decoded || ALLOWED[decoded]?.mime !== kind.mime) {
    throw new MediaValidationError("O conteúdo do arquivo não corresponde ao formato declarado.");
  }
  if (!meta.width || !meta.height || meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new MediaValidationError(`Dimensões inválidas (máximo ${MAX_DIMENSION}px por lado).`);
  }
  if ((meta.pages ?? 1) > 1) {
    throw new MediaValidationError("Imagens animadas ou com várias páginas não são aceitas.");
  }

  // rotate() aplica a orientação do EXIF; sem withMetadata(), o sharp
  // descarta EXIF/XMP/GPS na saída.
  const base = () => sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
  const original = await base().toFormat(kind.ext === "jpg" ? "jpeg" : kind.ext, { quality: 90 }).toBuffer();
  const oriented = await sharp(original).metadata();
  const width = oriented.width ?? meta.width;
  const height = oriented.height ?? meta.height;

  const widths = [...new Set([...VARIANT_WIDTHS.filter((w) => w < width), Math.min(width, VARIANT_WIDTHS.at(-1)!)])].sort((a, b) => a - b);
  const variants = await Promise.all(
    widths.map(async (w) => {
      const { data, info } = await base()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, buffer: data };
    }),
  );

  return {
    kind,
    width,
    height,
    sha256: createHash("sha256").update(input).digest("hex"),
    original,
    variants,
  };
}
