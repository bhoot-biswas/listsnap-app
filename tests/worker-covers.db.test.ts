import { afterAll, describe, expect, it } from "vitest";
import { createTestJob, createTestWorkspace, dbEnv, samplePhoto } from "./db-helpers";

/**
 * Which pages only watch: exactly the work the worker picks up, here with
 * PIPELINE_WORKER=batches. Anything it wouldn't pick up must still be driven by its page.
 */
const enabled = dbEnv();
process.env.PIPELINE_WORKER = "batches";

describe.skipIf(!enabled)("what the worker covers (MariaDB)", async () => {
  const { execute, getPool } = await import("@/server/db/pool");
  const { forWorkspace } = await import("@/server/db/scope");
  const { workerCovers } = await import("@/server/worker/covers");

  const shop = await createTestWorkspace();
  const ws = forWorkspace(shop.workspace.id);
  const demo = { ...shop.workspace, isDemo: true };
  afterAll(async () => {
    await shop.remove();
    await getPool().end();
  });

  const videoBatch = async () => {
    const id = await ws.createBatch(1);
    await execute("UPDATE batches SET video_media_id = 'v' WHERE id = ?", [id]);
    return id;
  };

  it("covers a video batch and its jobs, not a photo job or a bulk of photos", async () => {
    const batchId = await videoBatch();
    const fromVideo = await createTestJob(ws.id, await samplePhoto("saree.jpg"));
    await execute("UPDATE jobs SET batch_id = ? WHERE id = ?", [batchId, fromVideo]);
    const photo = await createTestJob(ws.id, await samplePhoto("saree.jpg"));
    const photos = await ws.createBatch(3);

    expect(await workerCovers(shop.workspace, "batch", batchId)).toBe(true);
    expect(await workerCovers(shop.workspace, "job", fromVideo)).toBe(true);
    expect(await workerCovers(shop.workspace, "job", photo)).toBe(false);
    expect(await workerCovers(shop.workspace, "batch", photos)).toBe(false);
  });

  it("leaves a demo batch without a kept visitor, and a day-old one, to their page", async () => {
    const batchId = await videoBatch();
    expect(await workerCovers(demo, "batch", batchId)).toBe(false);
    await ws.rememberVisitor("batches", batchId, "b".repeat(64));
    expect(await workerCovers(demo, "batch", batchId)).toBe(true);
    await execute("UPDATE batches SET created_at = UTC_TIMESTAMP(3) - INTERVAL 25 HOUR WHERE id = ?", [batchId]);
    expect(await workerCovers(demo, "batch", batchId)).toBe(false);
  });

  it("covers nothing of another shop", async () => {
    const other = await createTestWorkspace();
    expect(await workerCovers(other.workspace, "batch", await videoBatch())).toBe(false);
    await other.remove();
  });
});
