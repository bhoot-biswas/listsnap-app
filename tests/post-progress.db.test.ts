import { afterAll, describe, expect, it } from "vitest";
import { createTestJob, createTestWorkspace, dbEnv, samplePhoto } from "./db-helpers";

/**
 * A post's progress on its step row: saved only while the step runs, and still there when
 * the try fails, so the next try can finish that same post instead of making another.
 */
const enabled = dbEnv();

describe.skipIf(!enabled)("post progress on the step (MariaDB)", async () => {
  const { getPool } = await import("@/server/db/pool");
  const { saveStepProgress, sqlStepStore, stepProgress } = await import("@/server/db/steps");
  const { runStep, StepError } = await import("@/server/pipeline/run-step");

  const shop = await createTestWorkspace();
  const jobId = await createTestJob(shop.workspace.id, await samplePhoto("saree.jpg"));
  const store = sqlStepStore(shop.workspace.id);
  const key = { jobId, step: "post", target: "probe:en:facebook" };

  afterAll(async () => {
    await shop.remove();
    await getPool().end();
  });

  it("keeps what a failed try saved for the next try, and saves nothing outside a run", async () => {
    await store.ensure(key);
    await saveStepProgress(shop.workspace.id, key, { container: "outside" });
    expect(await stepProgress(shop.workspace.id, key)).toBeNull();

    const failed = await runStep(store, key, { lockMs: 30_000 }, async () => {
      await saveStepProgress(shop.workspace.id, key, { container: "C" });
      throw new StepError("metaNoAnswer");
    });
    expect(failed).toMatchObject({ state: "failed" });

    let seen: unknown;
    await runStep(store, key, { lockMs: 30_000 }, async () => {
      seen = await stepProgress(shop.workspace.id, key);
      return "posted";
    });
    expect(seen).toEqual({ container: "C" });
  });

  it("reads nothing for another shop's step", async () => {
    const other = await createTestWorkspace();
    expect(await stepProgress(other.workspace.id, key)).toBeNull();
    await other.remove();
  });
});
