import { z } from "zod";
import { apiViewer } from "@/server/auth/session";
import { forWorkspace } from "@/server/db/scope";
import { fail, notFound, ok, unauthorized } from "@/server/http";

const Body = z.object({ paused: z.boolean() });

/**
 * The bulk page's Pause and Resume (`{ paused }`). Kept on the batch, so every tab and the
 * server's own worker stop starting its steps; a step already running finishes.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/batches/[id]/pause">) {
  const viewer = await apiViewer();
  if (!viewer) return unauthorized();
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "invalid", "invalidRequest");
  const done = await forWorkspace(viewer.workspace.id).setBatchPaused((await ctx.params).id, body.data.paused);
  return done ? ok({ paused: body.data.paused }) : notFound();
}
