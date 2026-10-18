import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { detectImageType, processImage, MediaValidationError } = await import("@/lib/media/process");

async function makeImage(format: "jpeg" | "png" | "webp", width = 2000, height = 1200, withExif = false) {
  let img = sharp({ create: { width, height, channels: 3, background: "#41957d" } });
  if (withExif) {
    img = img.withExif({ IFD0: { Copyright: "Teste", Artist: "Pessoa" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1" } });
  }
  return img.toFormat(format).toBuffer();
}

describe("detecção do formato real", () => {
  it("reconhece JPEG, PNG e WebP pelos bytes", async () => {
    expect(detectImageType(await makeImage("jpeg", 10, 10))?.mime).toBe("image/jpeg");
    expect(detectImageType(await makeImage("png", 10, 10))?.mime).toBe("image/png");
    expect(detectImageType(await makeImage("webp", 10, 10))?.mime).toBe("image/webp");
  });

  it("recusa SVG, HTML e executável disfarçados", () => {
    const enc = new TextEncoder();
    expect(detectImageType(enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(detectImageType(enc.encode("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull(); // "MZ" (exe)
  });
});

describe("processamento", () => {
  it("gera variantes webp sem ampliar e remove EXIF/GPS", async () => {
    const input = await makeImage("jpeg", 2000, 1200, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processImage(input);
    expect(out.kind.mime).toBe("image/jpeg");
    expect(out.width).toBe(2000);
    expect(out.variants.map((v) => v.width)).toEqual([480, 960, 1600]);
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);

    expect((await sharp(out.original).metadata()).exif).toBeUndefined();
    for (const v of out.variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
    }
  });

  it("imagem pequena não é ampliada", async () => {
    const out = await processImage(await makeImage("png", 300, 200));
    expect(out.variants.map((v) => v.width)).toEqual([300]);
  });

  it("recusa conteúdo que não é imagem", async () => {
    await expect(processImage(Buffer.from("<svg></svg>"))).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("recusa arquivo com assinatura de JPEG mas corrompido", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("isto não é uma imagem")]);
    await expect(processImage(fake)).rejects.toBeInstanceOf(MediaValidationError);
  });
});
