import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { dbEnv } from "./db-helpers";

/**
 * The migration runner, run as the deploy runs it, on folders of probe files this test
 * writes. Every probe table and recorded name carries this run's tag and is removed after.
 */
const enabled = dbEnv();

describe.skipIf(!enabled)("migration runner (MariaDB)", async () => {
  const { execute, getPool, select, selectOne } = await import("@/server/db/pool");
  const tag = randomUUID().replace(/-/g, "").slice(0, 10);
  const dirs: string[] = [];
  const tables: string[] = [];

  afterAll(async () => {
    for (const t of tables.reverse()) await execute(`DROP TABLE IF EXISTS \`${t}\``);
    await execute("DELETE FROM listsnap_migrations WHERE name LIKE ?", [`%probe_${tag}%`]);
    for (const d of dirs) await rm(d, { recursive: true, force: true });
    await getPool().end();
  });

  /** A folder of migration files; `files` maps a file name to its SQL. */
  const folder = async (files: Record<string, string>) => {
    const dir = await mkdtemp(path.join(tmpdir(), "listsnap-migrate-"));
    dirs.push(dir);
    for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
    return dir;
  };
  const table = (name: string) => {
    const t = `probe_${tag}_${name}`;
    tables.push(t);
    return t;
  };
  const create = (t: string, extra = "") =>
    `CREATE TABLE IF NOT EXISTS \`${t}\` (id INT NOT NULL PRIMARY KEY${extra}) ENGINE=InnoDB;`;

  /** Runs the runner on `dir`; resolves with its exit code and output either way. */
  const run = (dir: string, ...args: string[]) =>
    promisify(execFile)("node", ["scripts/db-migrate.mjs", ...args], {
      env: { ...process.env, MIGRATIONS_DIR: dir },
    }).then(
      ({ stdout, stderr }) => ({ code: 0, out: stdout + stderr }),
      (err: { code: number; stdout: string; stderr: string }) => ({ code: err.code, out: err.stdout + err.stderr }),
    );
  const recorded = async (name: string) =>
    selectOne<{ checksum: string | null }>("SELECT checksum FROM listsnap_migrations WHERE name = ?", [name]);
  const exists = async (t: string) =>
    (await select("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [t]))
      .length > 0;

  it("applies each file once, with its checksum, and a second run applies nothing", async () => {
    const [a, b] = [table("a"), table("b")];
    const dir = await folder({ [`0001_probe_${tag}_a.sql`]: create(a), [`0002_probe_${tag}_b.sql`]: create(b) });

    const first = await run(dir);
    expect(first.code).toBe(0);
    expect(await exists(a)).toBe(true);
    expect(await exists(b)).toBe(true);
    expect((await recorded(`0001_probe_${tag}_a.sql`))?.checksum).toMatch(/^[0-9a-f]{64}$/);

    const second = await run(dir);
    expect(second.code).toBe(0);
    expect(second.out).toContain("nothing to apply");
  });

  it("stops at a failing file and leaves it unrecorded, so the next run tries it again", async () => {
    const [c, d] = [table("c"), table("d")];
    const broken = `0002_probe_${tag}_broken.sql`;
    const dir = await folder({
      [`0001_probe_${tag}_c.sql`]: create(c),
      [broken]: "CREATE TABLE this is not sql;",
      [`0003_probe_${tag}_d.sql`]: create(d),
    });

    const res = await run(dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain(`${broken} failed`);
    expect(await recorded(broken)).toBeNull();
    // what came after the broken file waits for it
    expect(await exists(d)).toBe(false);

    await writeFile(path.join(dir, broken), "SELECT 1;");
    expect((await run(dir)).code).toBe(0);
    expect(await exists(d)).toBe(true);
  });

  it("refuses a folder with a file not named like a migration, and runs nothing", async () => {
    const e = table("e");
    const dir = await folder({ [`0001_probe_${tag}_e.sql`]: create(e), "notes.sql": "SELECT 1;" });

    const res = await run(dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain("notes.sql");
    expect(await exists(e)).toBe(false);
  });

  it("reports an applied file that was edited later", async () => {
    const f = table("f");
    const name = `0001_probe_${tag}_f.sql`;
    const dir = await folder({ [name]: create(f) });
    await run(dir);
    await writeFile(path.join(dir, name), `${create(f)}\n-- edited`);

    const status = await run(dir, "--status");
    expect(status.out).toContain(`changed  ${name}`);
    expect((await run(dir)).out).toContain(`${name} changed after it was applied`);
  });

  it("two runs at once apply a file once", async () => {
    const g = table("g");
    const name = `0001_probe_${tag}_g.sql`;
    const dir = await folder({ [name]: `${create(g)}\nDO SLEEP(1);` });

    const results = await Promise.all([run(dir), run(dir)]);
    expect(results.map((r) => r.code)).toEqual([0, 0]);
    expect(results.filter((r) => r.out.includes(`applied ${name}`))).toHaveLength(1);
  });

  it("fails when a foreign key would block deleting an account or a shop", async () => {
    const [parent, child] = [table("parent"), table("child")];
    const dir = await folder({
      [`0001_probe_${tag}_restrict.sql`]:
        create(parent) +
        create(child, `, parent_id INT NOT NULL, FOREIGN KEY (parent_id) REFERENCES \`${parent}\` (id)`),
    });

    const res = await run(dir);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(new RegExp(`${child}\\..+ -> ${parent} is ON DELETE (RESTRICT|NO ACTION)`));
  });
});
