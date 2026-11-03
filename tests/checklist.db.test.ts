import { afterAll, describe, expect, it } from "vitest";
import { createTestWorkspace, dbEnv } from "./db-helpers";

/** Get started: a seller with no website ticks the first step by connecting their Facebook Page. */
const enabled = dbEnv();

describe.skipIf(!enabled)("Get started checklist (MariaDB)", async () => {
  const { getPool } = await import("@/server/db/pool");
  const { forWorkspace } = await import("@/server/db/scope");
  const { finishLogin } = await import("@/server/social/meta-connect");

  const a = await createTestWorkspace();
  const A = forWorkspace(a.workspace.id);

  afterAll(async () => {
    await a.remove();
    await getPool().end();
  });

  it("counts a connected Facebook Page as the first step, and nothing posted yet", async () => {
    expect(await A.checklist()).toMatchObject({ store: false, reel: false });
    await finishLogin(a.workspace.id, "mock-code");
    expect(await A.checklist()).toMatchObject({ store: true, reel: false });
  });
});
