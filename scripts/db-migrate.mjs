#!/usr/bin/env node
/**
 * Applies the SQL files in db/migrations, in file-name order, each one once. What has run
 * is recorded by file name, with a checksum of its text, in `listsnap_migrations`, which
 * /api/health also reads.
 *
 *   pnpm db:migrate   apply what is pending (reads .env.local)
 *   pnpm db:status    list applied, pending and changed files, change nothing
 *
 * MySQL commits every CREATE and ALTER on its own, so a file that fails halfway can't be
 * rolled back. Files are written to be safe to run again (IF NOT EXISTS), and a failed one
 * is left unrecorded so the next run tries it again after the fix.
 *
 * MIGRATIONS_DIR points at another folder of files; the tests use it.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";

const DIR =
  process.env.MIGRATIONS_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const statusOnly = process.argv.includes("--status");
// a second runner (CI and a deploy, two builds) waits for the first instead of racing it
const LOCK = "listsnap_migrate";
const LOCK_WAIT_SECONDS = 60;
// 0026_short_name.sql; anything else in the folder is a mistake, not a migration
const NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

const url = (process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("[migrate] DATABASE_URL is not set.");
  process.exit(1);
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

const all = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
const strays = all.filter((f) => !NAME.test(f));
if (strays.length) {
  console.error(`[migrate] not named like 0001_name.sql, so not run: ${strays.join(", ")}. Rename or remove them.`);
  process.exit(1);
}
const files = await Promise.all(
  all.map(async (name) => {
    const sql = await readFile(path.join(DIR, name), "utf8");
    return { name, sql, checksum: sha256(sql) };
  }),
);

// migration files hold several statements each
const db = await createConnection({ uri: url, multipleStatements: true, timezone: "Z", connectTimeout: 10_000 });

try {
  await db.query(
    `CREATE TABLE IF NOT EXISTS listsnap_migrations (
       name VARCHAR(255) NOT NULL PRIMARY KEY,
       applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  const [[{ locked }]] = await db.query("SELECT GET_LOCK(?, ?) AS locked", [LOCK, LOCK_WAIT_SECONDS]);
  if (locked !== 1) throw new Error("another migration run is still going");

  // tables from before checksums were kept get the column once
  const [[{ has }]] = await db.query(
    `SELECT COUNT(*) AS has FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'listsnap_migrations' AND COLUMN_NAME = 'checksum'`,
  );
  if (!Number(has)) await db.query("ALTER TABLE listsnap_migrations ADD COLUMN checksum CHAR(64) NULL");

  const [rows] = await db.query("SELECT name, checksum FROM listsnap_migrations");
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  // an applied file edited later never runs again, so its change would silently not happen
  const changed = files.filter((f) => applied.get(f.name) && applied.get(f.name) !== f.checksum);
  for (const f of changed)
    console.warn(`[migrate] ${f.name} changed after it was applied; put the change in a new file.`);
  // rows recorded before checksums: take the file as it is now
  const unsummed = files.filter((f) => applied.has(f.name) && !applied.get(f.name));
  if (!statusOnly)
    for (const f of unsummed)
      await db.query("UPDATE listsnap_migrations SET checksum = ? WHERE name = ?", [f.checksum, f.name]);

  const pending = files.filter((f) => !applied.has(f.name));
  if (statusOnly) {
    const label = (f) => (!applied.has(f.name) ? "pending" : changed.includes(f) ? "changed" : "applied");
    for (const f of files) console.log(`${label(f)}  ${f.name}`);
    console.log(`[migrate] ${files.length - pending.length} applied, ${pending.length} pending.`);
  } else {
    for (const f of pending) {
      try {
        await db.query(f.sql);
      } catch (err) {
        console.error(`[migrate] ${f.name} failed: ${err.message}`);
        process.exitCode = 1;
        break;
      }
      await db.query("INSERT INTO listsnap_migrations (name, checksum) VALUES (?, ?)", [f.name, f.checksum]);
      console.log(`[migrate] applied ${f.name}`);
    }
    if (!process.exitCode) console.log(pending.length ? "[migrate] done." : "[migrate] nothing to apply.");
  }

  // Deleting an account or a shop deletes its rows through foreign keys. One key without an
  // ON DELETE rule would make that delete fail for every seller who has such a row.
  const [blocking] = await db.query(
    `SELECT TABLE_NAME AS t, CONSTRAINT_NAME AS c, REFERENCED_TABLE_NAME AS ref, DELETE_RULE AS rule
       FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND DELETE_RULE NOT IN ('CASCADE', 'SET NULL')`,
  );
  for (const k of blocking)
    console.error(`[migrate] ${k.t}.${k.c} -> ${k.ref} is ON DELETE ${k.rule}; it must CASCADE or SET NULL.`);
  if (blocking.length) process.exitCode = 1;
} finally {
  await db.end();
}
