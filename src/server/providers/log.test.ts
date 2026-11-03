import { beforeEach, describe, expect, it, vi } from "vitest";

/** What a failed outside call leaves in api_calls, which the seller's Usage page shows. */
const rows: unknown[][] = [];
vi.mock("@/server/db/pool", () => ({ execute: async (_sql: string, params: unknown[]) => void rows.push(params) }));

const { logged } = await import("./log");
const { StepError } = await import("@/server/pipeline/run-step");
const { parseStoredError } = await import("@/server/step-text");

const ctx = { workspaceId: "w", jobId: null, step: "post" };
const info = { provider: "facebook" as const, model: "graph-api", endpoint: "video_reels", mode: "live" as const };
const summary = () => rows.at(-1)![10] as string;

beforeEach(() => void (rows.length = 0));

describe("the call log", () => {
  it("keeps a worded error's key and values", async () => {
    await expect(
      logged(
        ctx,
        info,
        () => Promise.reject(new StepError("metaBusy")),
        () => ({ summary: "", costUsd: 0 }),
      ),
    ).rejects.toThrow();
    expect(parseStoredError(summary())).toEqual({ key: "metaBusy" });
  });

  it("keeps a raw error out of it, for the server log only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = new Error("HTTP 500: <html><body>Internal Server Error</body></html>");
    await expect(
      logged(
        ctx,
        info,
        () => Promise.reject(raw),
        () => ({ summary: "", costUsd: 0 }),
      ),
    ).rejects.toBe(raw);
    expect(summary()).not.toContain("HTTP 500");
    expect(parseStoredError(summary())).toEqual({ key: "generic" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("facebook video_reels"), raw.message);
    warn.mockRestore();
  });
});
