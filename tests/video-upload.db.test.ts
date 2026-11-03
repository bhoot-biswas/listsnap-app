import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createTestWorkspace, dbEnv, sampleVideo } from "./db-helpers";

/**
 * A video upload as the bulk page sends it: the raw body, written to disk as it arrives
 * and moved into place, never held in memory, and nothing left behind when it's refused.
 */
const enabled = dbEnv();

const viewer = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/server/auth/session", () => ({ apiViewer: async () => viewer.current }));

describe.skipIf(!enabled)("video upload (MariaDB)", async () => {
  const { getPool, selectOne } = await import("@/server/db/pool");
  const { env } = await import("@/server/env");
  const { VIDEO_MAX_MB } = await import("@/lib/schemas/video");
  const route = await import("@/app/api/videos/route");
  const shop = await createTestWorkspace();
  viewer.current = { workspace: shop.workspace };
  const incoming = () => readdir(path.join(env().mediaDir, ".incoming")).catch(() => []);

  afterAll(async () => {
    await shop.remove();
    await getPool().end();
  });

  const post = (body: BodyInit) =>
    route.POST(
      new Request("http://x/api/videos", {
        method: "POST",
        headers: { "content-type": "video/mp4" },
        body,
        // a stream needs half-duplex in Node's fetch
        ...({ duplex: "half" } as object),
      }),
    );

  it("stores the video it was sent, byte for byte, and leaves nothing in the incoming folder", async () => {
    const video = await sampleVideo(2);
    const res = await post(new Uint8Array(video));
    expect(res.status).toBe(201);
    const { batchId } = (await res.json()) as { batchId: string };
    const row = await selectOne<{ path: string; bytes: number }>(
      "SELECT m.path, m.bytes FROM batches b JOIN media m ON m.id = b.video_media_id WHERE b.id = ?",
      [batchId],
    );
    expect(row!.bytes).toBe(video.length);
    expect((await stat(path.join(env().mediaDir, row!.path))).size).toBe(video.length);
    expect(await incoming()).toEqual([]);
  });

  it("refuses a body past the limit as it arrives, and keeps none of it", async () => {
    const mb = new Uint8Array(1024 * 1024);
    let sent = 0;
    const tooBig = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ > VIDEO_MAX_MB) controller.close();
        else controller.enqueue(mb);
      },
    });
    const res = await post(tooBig);
    expect(res.status).toBe(413);
    expect(await incoming()).toEqual([]);
  });

  it("refuses a file that isn't a video, and keeps none of it", async () => {
    const res = await post(new Uint8Array(4096).fill(7));
    expect(res.status).toBe(415);
    expect(await incoming()).toEqual([]);
  });
});
