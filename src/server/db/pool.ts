import "server-only";
import { createPool, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import type { Connection as CoreConnection } from "mysql2";
import { env } from "@/server/env";

/**
 * One mysql2 pool for the app, and the few helpers every query in src/server/db goes
 * through. Values always travel as `?` parameters; nothing is spliced into SQL text.
 */

// what mysql2 accepts as query values (its own type isn't exported)
type Params = (NonNullable<unknown> | null | undefined)[];

// dev reloads re-run this module; one pool across them keeps connections from piling up
const g = globalThis as { __listsnapPool?: Pool };

// past this a query is stopped by the server, so one runaway query can't hold a connection
const STATEMENT_SECONDS = 30;

export function getPool(): Pool {
  if (g.__listsnapPool) return g.__listsnapPool;
  const pool = createPool({
    uri: env().databaseUrl,
    connectionLimit: env().poolSize,
    // when every connection is busy, requests wait in line; past this many, they fail at
    // once instead of piling up behind a stuck database
    queueLimit: 100,
    connectTimeout: 10_000,
    // every timestamp is stored and read as UTC; the UI turns it into Dhaka time
    timezone: "Z",
    charset: "utf8mb4_unicode_ci",
    // scores and costs are small DECIMALs; numbers are what the code does arithmetic on
    decimalNumbers: true,
    // a DATE is a calendar day, not an instant: as a Date it would shift with the time zone
    dateStrings: ["DATE"],
    enableKeepAlive: true,
  });
  // Runs on each new connection before it is handed out. The event passes the callback
  // connection underneath, not the promise one its type names.
  pool.on("connection", (promiseConn) => {
    const conn = promiseConn as unknown as CoreConnection;
    // NOW() and TIMESTAMP columns follow the session zone; leases, quotas and Dhaka days
    // assume UTC whatever the server is set to
    conn.query("SET SESSION time_zone = '+00:00'", (err) => {
      if (err) console.error("[db] setting the session time zone failed:", err.message);
    });
    // MariaDB's name for it; MySQL has no such variable and answers with an error, which
    // only means no server-side limit there
    conn.query(`SET SESSION max_statement_time = ${STATEMENT_SECONDS}`, () => {});
  });
  g.__listsnapPool = pool;
  return pool;
}

export async function select<T>(sql: string, params: Params = []): Promise<T[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function selectOne<T>(sql: string, params: Params = []): Promise<T | null> {
  return (await select<T>(sql, params))[0] ?? null;
}

export async function execute(sql: string, params: Params = []): Promise<ResultSetHeader> {
  const [result] = await getPool().query<ResultSetHeader>(sql, params);
  return result;
}

/** Runs `fn` on one connection inside a transaction: committed if it returns, rolled back if it throws. */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    conn.release();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
      conn.release();
    } catch {
      // a connection that can't roll back may still hold the transaction or be dead;
      // the next borrower must not get it
      conn.destroy();
    }
    throw err;
  }
}

/** For JSON columns: MariaDB stores them as text, so values go in as a JSON string. */
export const json = (value: unknown): string => JSON.stringify(value ?? null);
