import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestJob, createTestWorkspace, dbEnv, runJob, samplePhoto } from "./db-helpers";

/** Needs attention: listings ready to go out are listed, after anything that is a problem. */
const enabled = dbEnv();

describe.skipIf(!enabled)("Needs attention (MariaDB)", async () => {
  const { execute, getPool } = await import("@/server/db/pool");
  const { forWorkspace } = await import("@/server/db/scope");

  const a = await createTestWorkspace();
  const A = forWorkspace(a.workspace.id);
  let unsure = "";
  let ready = "";

  beforeAll(async () => {
    for (const name of ["saree", "kurti"] as const) {
      const jobId = await createTestJob(a.workspace.id, await samplePhoto(`${name}.jpg`));
      const id = (await runJob(a.workspace, jobId)).listings[0]!.id;
      if (name === "saree") unsure = id;
      else ready = id;
    }
    // the ready one is newer, so only the order of kinds puts it second
    await execute("UPDATE listings SET status = 'needs_review', created_at = ? WHERE id = ?", [
      new Date(Date.UTC(2030, 0, 1)),
      unsure,
    ]);
    await execute("UPDATE listings SET status = 'ready', created_at = ? WHERE id = ?", [
      new Date(Date.UTC(2030, 0, 2)),
      ready,
    ]);
  });

  afterAll(async () => {
    await a.remove();
    await getPool().end();
  });

  it("lists a ready listing after one that needs review, and drops it once it's in a store", async () => {
    expect((await A.attention()).map((r) => [r.kind, r.listing_id])).toEqual([
      ["review", unsure],
      ["ready", ready],
    ]);
    await A.markInStore(ready, "woo", "101");
    expect((await A.attention()).map((r) => r.kind)).toEqual(["review"]);
  });
});
