import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";

/**
 * The parts of deploy/deploy.sh that decide what goes live and what is kept, run in bash
 * from the script itself with GitHub's answers and the release folders made up here.
 * Nothing is deployed: only the functions are loaded, never the script's steps.
 */
const run = promisify(execFile);
const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

/** The named functions, cut out of the script as they are written there. */
async function functions(...names: string[]): Promise<string> {
  const script = await readFile(path.join(process.cwd(), "deploy/deploy.sh"), "utf8");
  return names
    .map((name) => {
      const m = new RegExp(`^${name}\\(\\) \\{\\n[\\s\\S]*?^\\}\\n`, "m").exec(script);
      if (!m) throw new Error(`no function ${name} in deploy.sh`);
      return m[0];
    })
    .join("\n");
}

/** Runs `body` after the functions, with `curl` answering from `answers` in turn. */
async function bash(fns: string, body: string, answers: string[] = []) {
  const dir = await mkdtemp(path.join(tmpdir(), "deploy-test-"));
  dirs.push(dir);
  await writeFile(path.join(dir, "answers"), answers.join("\n") + "\n");
  const stub = `
# ci_state runs in a subshell, so the count of answers given is kept in a file
echo 0 > ${dir}/n
curl() { local n; n=$(( $(cat ${dir}/n) + 1 )); echo $n > ${dir}/n; line=$(sed -n "\${n}p" ${dir}/answers); [ "$line" = FAIL ] && return 22; echo "$line"; }
sleep() { :; }
as_app() { echo "https://github.com/owner/repo.git"; }
APP=/nowhere
`;
  return run("bash", ["-c", `set -euo pipefail\n${stub}\n${fns}\n${body}`]).then(
    (r) => ({ code: 0, out: r.stdout + r.stderr }),
    (e: { code: number; stdout: string; stderr: string }) => ({ code: e.code, out: e.stdout + e.stderr }),
  );
}

const runs = (...list: { status: string; conclusion: string | null; name?: string }[]) =>
  JSON.stringify({ workflow_runs: list.map((r) => ({ name: "CI", ...r })) });

describe("deploy: waiting for CI", async () => {
  const fns = await functions("ci_state", "wait_for_ci");
  const wait = (answers: string[]) => bash(fns, "CI_WAIT_S=60; wait_for_ci abc123", answers);

  it("goes ahead once CI on the commit has passed", async () => {
    const r = await wait([
      runs({ status: "in_progress", conclusion: null }),
      runs({ status: "completed", conclusion: "success" }),
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("CI on abc123: pending, waiting");
    expect(r.out).toContain("CI passed.");
  });

  it("stops when CI failed", async () => {
    const r = await wait([runs({ status: "completed", conclusion: "failure" })]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("CI failed for abc123");
  });

  it("stops after waiting when CI never finishes or GitHub doesn't answer", async () => {
    const r = await wait(["FAIL", runs(), "FAIL", runs({ status: "queued", conclusion: null })]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("No passing CI for abc123");
  });

  it("only counts the CI workflow, and a passing re-run", async () => {
    const other = runs({ status: "completed", conclusion: "success", name: "Dependabot Updates" });
    expect((await wait([other, other, other, other])).code).toBe(1);
    const rerun = runs({ status: "completed", conclusion: "failure" }, { status: "completed", conclusion: "success" });
    expect((await wait([rerun])).code).toBe(0);
  });
});

describe("deploy: which releases are kept", async () => {
  const fns = await functions("prune_releases");

  it("keeps the live release and the two newest finished ones; failed builds never count", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "releases-"));
    dirs.push(root);
    // oldest first: good, good, good, failed, failed, then the new live one
    const names = ["1-good", "2-good", "3-good", "4-failed", "5-failed", "6-live"];
    for (const [i, name] of names.entries()) {
      const dir = path.join(root, name);
      await mkdir(path.join(dir, ".next"), { recursive: true });
      if (!name.includes("failed")) await writeFile(path.join(dir, ".next", "BUILD_ID"), "x");
      const t = new Date(Date.UTC(2026, 10, 3, 10, i));
      await utimes(dir, t, t);
    }
    const r = await bash(fns, `RELEASES=${root}; KEEP=3; prune_releases ${root}/6-live`);
    expect(r.code).toBe(0);
    // before, the two failed folders were "the newest three" with the live one, and every good one went
    expect((await readdir(root)).sort()).toEqual(["2-good", "3-good", "6-live"]);
  });
});
