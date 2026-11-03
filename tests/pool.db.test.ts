import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { dbEnv } from "./db-helpers";

/**
 * What every query relies on from the pool: how values come back, the session settings,
 * and transactions that roll back and never hand out a broken connection.
 */
const enabled = dbEnv();

describe.skipIf(!enabled)("database pool (MariaDB)", async () => {
  const { execute, getPool, json, selectOne, transaction } = await import("@/server/db/pool");
  const probe = `pool_probe_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await execute(
    `CREATE TABLE \`${probe}\` (
       id INT NOT NULL PRIMARY KEY,
       price DECIMAL(10,2) NULL,
       day DATE NULL,
       at TIMESTAMP(3) NULL,
       data_json JSON NULL
     ) ENGINE=InnoDB`,
  );

  afterAll(async () => {
    await execute(`DROP TABLE IF EXISTS \`${probe}\``);
    await getPool().end();
  });

  it("returns DECIMAL as a number, DATE as its day, TIMESTAMP as a UTC instant and JSON as a value", async () => {
    const at = new Date("2026-11-03T23:30:00.250Z");
    await execute(`INSERT INTO \`${probe}\` (id, price, day, at, data_json) VALUES (1, 450.5, '2026-11-03', ?, ?)`, [
      at,
      json({ items: [1, 2] }),
    ]);
    const row = await selectOne<{ price: number; day: string; at: Date; data_json: unknown }>(
      `SELECT price, day, at, data_json FROM \`${probe}\` WHERE id = 1`,
    );
    expect(row!.price).toBe(450.5);
    expect(row!.day).toBe("2026-11-03");
    expect(row!.at.toISOString()).toBe(at.toISOString());
    expect(row!.data_json).toEqual({ items: [1, 2] });
  });

  it("runs every connection in UTC with a statement time limit", async () => {
    const row = await selectOne<{ tz: string; limit: number }>(
      "SELECT @@session.time_zone AS tz, @@session.max_statement_time AS `limit`",
    );
    expect(row).toEqual({ tz: "+00:00", limit: 30 });
  });

  it("rolls a transaction back when it throws", async () => {
    await expect(
      transaction(async (conn) => {
        await conn.query(`INSERT INTO \`${probe}\` (id) VALUES (2)`);
        throw new Error("probe");
      }),
    ).rejects.toThrow("probe");
    expect(await selectOne(`SELECT id FROM \`${probe}\` WHERE id = 2`)).toBeNull();
  });

  it("drops a connection that died inside a transaction instead of handing it out again", async () => {
    await expect(
      transaction(async (conn) => {
        const [[{ id }]] =
          await conn.query<({ id: number } & import("mysql2").RowDataPacket)[]>("SELECT CONNECTION_ID() AS id");
        await execute("KILL ?", [id]);
        await conn.query("SELECT 1");
      }),
    ).rejects.toThrow();
    // every connection the pool hands out now works
    const pool = getPool();
    const conns = await Promise.all(Array.from({ length: 3 }, () => pool.getConnection()));
    for (const c of conns) {
      await expect(c.query("SELECT 1")).resolves.toBeTruthy();
      c.release();
    }
  });
});
