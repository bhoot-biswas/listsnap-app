import "server-only";
import { StepError } from "./run-step";
import type { ListingStepContext } from "./listing-steps";
import { env } from "@/server/env";
import { signedMediaUrl } from "@/server/media/signed";
import { facebook, instagram } from "@/server/providers";
import { metaConnection } from "@/server/social/connection";
import { metaPageWorks, metaRefusal, metaRefused } from "@/server/social/meta-health";
import { ReelResult } from "@/lib/schemas/reels";
import { PostProgress, type PostRequest, type PostResult } from "@/lib/schemas/social";

// Meta fetches the video itself, and a large reel can wait in its queue for a while
const VIDEO_LINK_TTL_S = 60 * 60;

/** Where the step keeps how far an earlier try of this post got. */
export interface PostCheckpoint {
  read(): Promise<unknown>;
  save(progress: PostProgress): Promise<void>;
}

/**
 * Step `post` (on request, always confirmed): the listing's latest reel in one language
 * to one destination. Its saved result is the post, so asking again, from another tab or
 * after a timeout, returns that post instead of posting twice. A try that failed or died
 * after Meta had the video leaves its progress, and the next try finishes that same post.
 */
export async function postStep(
  ctx: ListingStepContext,
  req: PostRequest,
  checkpoint: PostCheckpoint,
): Promise<PostResult> {
  const { ws, listing } = ctx;
  const reel = ReelResult.safeParse(await ws.stepResult(listing.job_id, "reel", `${listing.id}:showcase:${req.lang}`));
  if (!reel.success) throw new StepError("makeReelFirst");

  const conn = await metaConnection(ws);
  if (!conn) throw new StepError("connectFacebook");
  const live = env().providers[req.destination] === "live";
  if (conn.settings.test && live) throw new StepError("testConnection");
  const account = conn.account(req.destination);
  if (!account) throw new StepError(req.destination === "facebook" ? "connectFacebook" : "noInstagram");

  const call = { workspaceId: ws.id, jobId: listing.job_id, step: "post" };
  const videoUrl = signedMediaUrl(ws.id, reel.data.mediaId, "video/mp4", VIDEO_LINK_TTL_S);
  const saved = PostProgress.safeParse(await checkpoint.read());
  const input = {
    videoUrl,
    caption: req.caption,
    resume: saved.success ? saved.data : null,
    checkpoint: checkpoint.save,
  };
  let post;
  try {
    post =
      req.destination === "facebook"
        ? await facebook().postReel(call, { ...input, page: account })
        : await instagram().postReel(call, { ...input, account });
  } catch (err) {
    // Instagram posts with the Page's login too, so either refusal means it has stopped working
    if (metaRefusal(err)) await metaRefused(ws, "page");
    throw err;
  }
  if (conn.broken) await metaPageWorks(ws);

  // nothing reached Facebook or Instagram, so the listing isn't Posted and isn't counted
  const test = conn.settings.test || !live;
  if (!test) await ws.markPosted(listing.id, req.destination === "instagram" ? post.postId || null : null);
  return {
    destination: req.destination,
    lang: req.lang,
    reelMediaId: reel.data.mediaId,
    postId: post.postId,
    permalink: post.permalink,
    test,
  };
}
