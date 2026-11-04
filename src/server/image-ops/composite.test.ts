import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { compositeOnBackground } = await import("./index");

const size = { width: 1024, height: 1024, scale: 0.72 };
const background = () =>
  sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#dddddd" } })
    .jpeg()
    .toBuffer();

/** A red box in the middle of a transparent file, with a wide empty margin under it. */
const cutout = () =>
  sharp({ create: { width: 800, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      {
        input: { create: { width: 400, height: 400, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } },
        left: 200,
        top: 100,
      },
    ])
    .png()
    .toBuffer();

const pixel = async (image: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels;
  return [data[at]!, data[at + 1]!, data[at + 2]!] as const;
};

describe("compositeOnBackground", () => {
  it("rests a cutout on its shadow, whatever empty margin its file has", async () => {
    const image = await compositeOnBackground(await background(), await cutout(), { ...size, shadow: "contact" });
    const [red, green] = await pixel(image, 512, 880);
    expect(red).toBeGreaterThan(150);
    expect(green).toBeLessThan(90);
    // just under the base it is darker than the backdrop, and the backdrop is left alone higher up
    expect((await pixel(image, 512, 906))[0]).toBeLessThan(205);
    expect((await pixel(image, 20, 20))[0]).toBeGreaterThan(215);
  });

  it("still takes a photo with no transparency", async () => {
    const photo = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#884422" } })
      .jpeg()
      .toBuffer();
    const image = await compositeOnBackground(await background(), photo, { ...size, shadow: "contact" });
    expect((await sharp(image).metadata()).width).toBe(1024);
  });

  it("fits a wide cutout on the banner", async () => {
    const wide = await sharp({ create: { width: 1500, height: 300, channels: 4, background: "#884422" } })
      .png()
      .toBuffer();
    const image = await compositeOnBackground(await background(), wide, {
      width: 1536,
      height: 768,
      scale: 0.8,
      centerX: 0.66,
      shadow: "contact",
    });
    expect((await sharp(image).metadata()).width).toBe(1536);
  });
});
