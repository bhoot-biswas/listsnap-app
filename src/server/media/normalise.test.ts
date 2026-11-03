import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalisePhoto } from "./store";

const pngChunk = (type: string, data: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, crc]);
};

/** A tiny PNG that claims to be `width` × `height`, with almost no pixels behind it. */
function claimedPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.alloc(0))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("what an upload may be", () => {
  it("re-encodes a phone photo as a JPEG", async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c00" } })
      .png()
      .toBuffer();
    const out = await normalisePhoto(png);
    expect(out).toMatchObject({ width: 40, height: 30 });
    expect((await sharp(out.data).metadata()).format).toBe("jpeg");
  });

  it("refuses formats that aren't photos, even ones the image library reads", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
      .gif()
      .toBuffer();
    await expect(normalisePhoto(svg)).rejects.toThrow();
    await expect(normalisePhoto(gif)).rejects.toThrow();
  });

  it("refuses a small file that claims to be enormous, before decoding it", async () => {
    // 225 MP: under sharp's own default limit, so only ours stops it
    await expect(normalisePhoto(claimedPng(15_000, 15_000))).rejects.toThrow(/pixel limit|too large/);
  });
});
