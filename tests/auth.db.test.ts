import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { dbEnv } from "./db-helpers";

/**
 * The Better Auth setup itself, called the way its routes are: how long a session lasts,
 * the session cookie cache, how sign-in links are stored, and the sign-in rate limits.
 * Each request carries its own made-up IP, so the limits of one test don't reach another.
 */
const enabled = dbEnv();

// the link the sign-in mail would carry
const sent: string[] = [];
vi.mock("@/server/auth/mail", () => ({ sendMagicLinkMail: (_to: string, url: string) => void sent.push(url) }));

describe.skipIf(!enabled)("Better Auth setup (MariaDB)", async () => {
  const { execute, getPool, select, selectOne } = await import("@/server/db/pool");
  const { getAuth } = await import("@/server/auth/auth");
  const auth = getAuth();
  const DAY_MS = 86_400_000;

  const users: string[] = [];
  const emails: string[] = [];
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const headers = () => new Headers({ "x-real-ip": `10.${octet()}.${octet()}.${octet()}` });

  afterAll(async () => {
    for (const id of users) {
      await execute("DELETE w FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ?", [id]);
      await execute("DELETE FROM `user` WHERE id = ?", [id]);
    }
    for (const email of emails) await execute("DELETE FROM verification WHERE value LIKE ?", [`%${email}%`]);
    await getPool().end();
  });

  const demoSignIn = async (h = headers()) => {
    const res = await auth.api.signInAnonymous({ headers: h, asResponse: true });
    const body = (await res.json()) as { user?: { id: string } };
    if (body.user) users.push(body.user.id);
    return { res, userId: body.user?.id };
  };

  it("keeps a session for 30 days and caches it in a cookie", async () => {
    const { res, userId } = await demoSignIn();
    expect(res.status).toBe(200);
    const session = await selectOne<{ expiresAt: Date }>("SELECT expiresAt FROM `session` WHERE userId = ?", [userId]);
    const days = (session!.expiresAt.getTime() - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    // the cached copy saves a session lookup per request
    expect(res.headers.getSetCookie().some((c) => c.startsWith("listsnap.session_data="))).toBe(true);
  });

  it("gives every new user a workspace", async () => {
    const { userId } = await demoSignIn();
    const rows = await select("SELECT workspace_id FROM memberships WHERE user_id = ?", [userId]);
    expect(rows).toHaveLength(1);
  });

  it("stores a sign-in link's token hashed, and the link still signs in", async () => {
    const email = `${randomUUID().slice(0, 8)}@auth-test.invalid`;
    emails.push(email);
    const h = headers();
    await auth.api.signInMagicLink({ body: { email, callbackURL: "/dashboard" }, headers: h });
    const token = new URL(sent.at(-1)!).searchParams.get("token")!;
    expect(token).toBeTruthy();
    // the plugin prefixes the stored identifier, so look for the token anywhere in it
    expect(await selectOne("SELECT id FROM verification WHERE INSTR(identifier, ?) > 0", [token])).toBeNull();

    const res = await auth.api.magicLinkVerify({
      query: { token, callbackURL: "/dashboard" },
      headers: h,
      asResponse: true,
    });
    expect(res.headers.getSetCookie().some((c) => c.startsWith("listsnap.session_token="))).toBe(true);
    const user = await selectOne<{ id: string }>("SELECT id FROM `user` WHERE email = ?", [email]);
    users.push(user!.id);
  });

  it("allows 5 sign-in links per IP in 10 minutes", async () => {
    const h = headers();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const email = `${randomUUID().slice(0, 8)}@auth-test.invalid`;
      emails.push(email);
      const res = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-real-ip": h.get("x-real-ip")!,
          },
          body: JSON.stringify({ email }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
