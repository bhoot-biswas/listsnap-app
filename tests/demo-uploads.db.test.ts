import { randomInt } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createTestWorkspace, dbEnv, samplePhoto } from "./db-helpers";

/**
 * The per-visitor counts that a new demo shop must not reset: photos kept without a
 * listing, reels, and live dictation. The routes are called the way the browser calls
 * them, with the visitor's address in Nginx's header.
 */
const enabled = dbEnv();

const viewer = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/server/auth/session", () => ({ apiViewer: async () => viewer.current }));

describe.skipIf(!enabled)("demo visitor's photos, reels and dictation across shops (MariaDB)", async () => {
  const { execute, getPool } = await import("@/server/db/pool");
  const { DEMO_PER_IP, demoIpLimit } = await import("@/server/db/limits");
  const { env } = await import("@/server/env");
  const { takeDemoAllowance } = await import("@/server/limits");
  const chatPhotos = await import("@/app/api/chat/photos/route");
  const dictate = await import("@/app/api/dictate/route");

  const ip = `203.0.${randomInt(0, 256)}.${randomInt(1, 255)}`;
  const hash = demoIpLimit.hash(ip, env().authSecret);
  const a = await createTestWorkspace();
  const b = await createTestWorkspace();
  const demoA = { ...a.workspace, isDemo: true };
  const demoB = { ...b.workspace, isDemo: true };
  const photo = await samplePhoto("saree.jpg");

  afterAll(async () => {
    await execute("DELETE FROM ip_daily WHERE ip_hash = ?", [hash]);
    await execute("DELETE FROM media WHERE workspace_id IN (?, ?)", [a.workspace.id, b.workspace.id]);
    await a.remove();
    await b.remove();
    await getPool().end();
  });

  const fill = (counter: string, n: number) =>
    execute(
      `INSERT INTO ip_daily (ip_hash, date, ${counter}) VALUES (?, UTC_DATE(), ?) ON DUPLICATE KEY UPDATE ${counter} = VALUES(${counter})`,
      [hash, n],
    );
  const upload = () => {
    const form = new FormData();
    form.append("photo", new File([photo], "saree.jpg", { type: "image/jpeg" }));
    return chatPhotos.POST(
      new Request("http://x/api/chat/photos", { method: "POST", body: form, headers: { "x-real-ip": ip } }),
    );
  };

  it("counts reels across a visitor's demo shops", async () => {
    await fill("reels", 0);
    for (let i = 0; i < DEMO_PER_IP.reels; i++)
      expect(await takeDemoAllowance(i % 2 ? demoA : demoB, ip, "reels")).not.toBeNull();
    expect(await takeDemoAllowance(demoA, ip, "reels")).toBeNull();
    // a real shop has only its own daily reels
    expect(await takeDemoAllowance(a.workspace, ip, "reels")).not.toBeNull();
  });

  it("refuses a chat photo once the visitor's uploads are used, in a new demo shop too", async () => {
    await fill("uploads", 0);
    viewer.current = { workspace: demoA };
    expect((await upload()).status).toBe(201);
    await fill("uploads", DEMO_PER_IP.uploads);
    viewer.current = { workspace: demoB };
    expect((await upload()).status).toBe(429);
    viewer.current = { workspace: a.workspace };
    expect((await upload()).status).toBe(201);
  });

  it("refuses live dictation once the visitor's AI calls are used", async () => {
    await fill("ai_calls", DEMO_PER_IP.ai_calls);
    viewer.current = { workspace: demoB };
    const res = await dictate.POST(
      new Request("http://x/api/dictate", { method: "POST", headers: { "x-real-ip": ip } }),
    );
    expect(res.status).toBe(429);
  });
});
