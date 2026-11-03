import "server-only";
import { GraphError, graph, wait as realWait } from "../graph";
import type { CallContext, InstagramProvider, SocialAccount } from "../types";

/**
 * Instagram posting through the Graph API, as the Instagram account linked to the
 * seller's Page and with that Page's token. Every post is a container Instagram builds
 * from our signed links, then a publish once it's ready. A reel's container is saved
 * before it is published, so a retry publishes that one: one container is at most one post.
 */

// a short reel is usually ready in well under a minute; the post must answer within two
const READY_TRIES = 25;
const READY_WAIT_MS = 3_000;

export function makeLiveInstagram(wait = realWait): InstagramProvider {
  return {
    mode: "live",

    async postReel(ctx, { account, videoUrl, caption, resume, checkpoint }) {
      let container = resume && "container" in resume ? resume.container : null;
      if (container) {
        // an earlier try made this container; publishing it again can't make a second post
        const code = await statusCode(ctx, account, container).catch(() => null);
        if (code === null) throw new GraphError(0, 0, "metaPostUnknown");
        if (code === "PUBLISHED") return published(ctx, account, caption);
        if (code === "ERROR" || code === "EXPIRED") container = null;
      }
      if (!container) {
        container = await create(ctx, account, {
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          share_to_feed: true,
        });
        await checkpoint?.({ container });
      }
      if ((await whenReady(ctx, account, container, wait)) === "PUBLISHED") return published(ctx, account, caption);
      try {
        return await publish(ctx, account, container);
      } catch (err) {
        // with no answer, or a server error, Instagram may have published it anyway
        if (!(err instanceof GraphError && (err.status === 0 || err.status >= 500))) throw err;
        const code = await statusCode(ctx, account, container).catch(() => null);
        if (code === "PUBLISHED") return published(ctx, account, caption);
        throw err;
      }
    },

    async postCarousel(ctx, { account, imageUrls, caption }) {
      const children: string[] = [];
      for (const url of imageUrls)
        children.push(await create(ctx, account, { image_url: url, is_carousel_item: true }));
      const container = await create(ctx, account, {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption,
      });
      await whenReady(ctx, account, container, wait);
      const post = await publish(ctx, account, container);
      return { mediaId: post.postId, permalink: post.permalink };
    },
  };
}

async function create(ctx: CallContext, account: SocialAccount, params: Record<string, string | boolean>) {
  const res = await graph<{ id: string }>(ctx, {
    provider: "instagram",
    endpoint: "media",
    method: "POST",
    path: `/${account.id}/media`,
    params,
    token: account.token,
  });
  return res.id;
}

const containerStatus = (ctx: CallContext, account: SocialAccount, container: string) =>
  graph<{ status_code?: string; status?: string }>(ctx, {
    provider: "instagram",
    endpoint: "media status",
    method: "GET",
    path: `/${container}`,
    params: { fields: "status_code,status" },
    token: account.token,
  });

const statusCode = async (ctx: CallContext, account: SocialAccount, container: string) =>
  (await containerStatus(ctx, account, container)).status_code ?? "";

/**
 * Instagram downloads and checks the file in the background; publishing before FINISHED
 * fails. PUBLISHED means an earlier try already published this container.
 */
async function whenReady(
  ctx: CallContext,
  account: SocialAccount,
  container: string,
  wait: (ms: number) => Promise<unknown>,
): Promise<"FINISHED" | "PUBLISHED"> {
  for (let i = 0; i < READY_TRIES; i++) {
    const res = await containerStatus(ctx, account, container);
    if (res.status_code === "FINISHED" || res.status_code === "PUBLISHED") return res.status_code;
    if (res.status_code === "ERROR" || res.status_code === "EXPIRED") {
      // `status` holds Instagram's reason, e.g. a video that is too long or the wrong shape
      const message = res.status?.slice(0, 200);
      throw message ? new GraphError(200, 0, "metaSaid", { message }) : new GraphError(200, 0, "metaVideo");
    }
    await wait(READY_WAIT_MS);
  }
  throw new GraphError(200, 0, "metaSlow");
}

async function publish(ctx: CallContext, account: SocialAccount, container: string) {
  const { id } = await graph<{ id: string }>(ctx, {
    provider: "instagram",
    endpoint: "media_publish",
    method: "POST",
    path: `/${account.id}/media_publish`,
    params: { creation_id: container },
    token: account.token,
  });
  // the post is made; a missing link must not make the seller post it again
  const permalink = await graph<{ permalink?: string }>(ctx, {
    provider: "instagram",
    endpoint: "media permalink",
    method: "GET",
    path: `/${id}`,
    params: { fields: "permalink" },
    token: account.token,
  })
    .then((r) => r.permalink)
    .catch(() => undefined);
  return { postId: id, permalink: permalink ?? `https://www.instagram.com/${account.name.replace(/^@/, "")}/` };
}

/**
 * The post an earlier try published, whose answer never arrived. A container doesn't name
 * the post it became, so it is the newest of the account's posts with this caption; the
 * profile link stands in when Instagram doesn't list it yet.
 */
async function published(ctx: CallContext, account: SocialAccount, caption: string) {
  const recent = await graph<{ data?: { id: string; permalink?: string; caption?: string }[] }>(ctx, {
    provider: "instagram",
    endpoint: "media list",
    method: "GET",
    path: `/${account.id}/media`,
    params: { fields: "id,permalink,caption", limit: 10 },
    token: account.token,
  })
    .then((r) => r.data ?? [])
    .catch(() => []);
  const post = recent.find((m) => (m.caption ?? "").trim() === caption.trim());
  return {
    postId: post?.id ?? "",
    permalink: post?.permalink ?? `https://www.instagram.com/${account.name.replace(/^@/, "")}/`,
  };
}

export const liveInstagram = makeLiveInstagram();
