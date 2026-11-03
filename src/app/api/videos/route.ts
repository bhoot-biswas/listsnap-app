import { apiViewer } from "@/server/auth/session";
import { forWorkspace } from "@/server/db/scope";
import { fail, ok, unauthorized } from "@/server/http";
import { clientIp, takeDemoAllowance } from "@/server/limits";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { incomingPath, saveMediaFile } from "@/server/media/store";
import { openVideoFile } from "@/server/media/video";
import { VIDEO_MAX_MB, VIDEO_MAX_S } from "@/lib/schemas/video";

const TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
/** Each video is up to twelve listings, so a few a day is already a lot of listings. */
const PER_DAY = 5;

/**
 * Starts a bulk batch from a video of the seller's products, sent as the raw request body
 * (not a form, so a phone's large file streams in without being held twice). The video is
 * kept as media; watching it is the batch's first step, driven by the bulk page, which
 * makes one job per product it finds. Listing slots are taken then, one per product.
 */
export async function POST(request: Request) {
  const viewer = await apiViewer();
  if (!viewer) return unauthorized();
  const type = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
  if (!TYPES.has(type)) return fail(415, "unsupported_file", "notVideo");
  const max = VIDEO_MAX_MB * 1024 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > max)
    return fail(413, "too_large", "videoTooLarge", { mb: VIDEO_MAX_MB });

  const ws = forWorkspace(viewer.workspace.id);
  if ((await ws.videosToday()) >= PER_DAY) return fail(429, "limit", "videoLimit");
  // a demo visitor's videos are counted across their demo shops, before the body is read
  const release = await takeDemoAllowance(viewer.workspace, clientIp(request), "videos");
  if (!release) return fail(429, "limit", "videoLimit");
  const refuse = async (response: Promise<Response>) => (await release(), response);

  // the body goes straight to a file as it arrives: a 200 MB video is never held in memory
  const file = await incomingPath();
  try {
    const size = await receiveCapped(request, file, max);
    if (size === null) return refuse(fail(413, "too_large", "videoTooLarge", { mb: VIDEO_MAX_MB }));
    const video = await openVideoFile(file);
    let seconds: number | null;
    try {
      seconds = await video.seconds();
    } finally {
      await video.done();
    }
    if (!seconds) return refuse(fail(415, "unsupported_file", "unreadableVideo"));
    // a second over is a rounding of the phone's own limit, not a longer video
    if (seconds > VIDEO_MAX_S + 1) return refuse(fail(400, "too_long", "videoTooLong", { minutes: VIDEO_MAX_S / 60 }));

    const media = await saveMediaFile(ws.id, "video", file, { mime: type, width: 0, height: 0, selected: false });
    const batchId = await ws.createVideoBatch(media.id);
    return ok({ batchId }, 201);
  } catch (err) {
    // nothing was made, so the visitor's video for today is given back
    await release();
    throw err;
  } finally {
    // kept videos were moved into place; anything still here was refused or failed
    await rm(file, { force: true });
  }
}

/** Writes the body to `file`; its size, or null when empty or once it passes `max` bytes, whatever Content-Length claimed. */
async function receiveCapped(request: Request, file: string, max: number): Promise<number | null> {
  if (!request.body) return null;
  let size = 0;
  const capped = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.length;
      if (size > max) controller.error(new Error("too large"));
      else controller.enqueue(chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body.pipeThrough(capped) as ReadableStream), createWriteStream(file));
  } catch (err) {
    if (size > max) return null;
    throw err;
  }
  return size ? size : null;
}
