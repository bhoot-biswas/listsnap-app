"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BatchState } from "@/lib/batch-state";
import { pace } from "@/lib/step-pacing";
import { loadState } from "./load-state";
import { useDoneCue } from "./use-done-cue";
import { useWakeLock } from "./use-wake-lock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Jobs worked on at once: Muse Image's 150 images a minute sets the pace. */
export const JOBS_AT_ONCE = 2;

/**
 * Drives a bulk batch from the browser, two photos at a time, after watching its video
 * when it comes from one. Like the single-job
 * runner it only makes the calls the server lists as next, so pausing, a refresh or a
 * second tab never repeats finished work. It starts by itself right after the upload
 * (`autoStart`) and whenever the batch is opened again, unless the seller pressed Pause:
 * that is remembered in this browser until they press Resume.
 * Losing the connection, or the state, isn't a pause: it carries on by itself once the
 * connection or the tab is back, and says what's happening meanwhile.
 */
export function useBatchRunner(initial: BatchState, autoStart: boolean) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [running, setRunning] = useState(false);
  // the seller's own Pause, as opposed to a dropped connection
  const [paused, setPaused] = useState(!autoStart);
  const [offline, setOffline] = useState(false);
  /** The batch's state couldn't be loaded, so nothing moves until it can be. */
  const [stalled, setStalled] = useState(false);
  const wanted = useRef(autoStart);
  const busy = useRef(false);
  const alive = useRef(true);
  const id = initial.id;

  useWakeLock(running);
  // done when the runner stopped on its own with nothing left it can do
  const settled = !running && !paused && !offline && !stalled && !hasWork(state);
  useDoneCue(settled ? (state.rows.every((r) => r.jobStatus === "ready") ? "ready" : "needs-you") : false);

  const load = useCallback(async (): Promise<BatchState | null> => {
    const r = await loadState<BatchState>(`/api/batches/${id}`);
    if ("error" in r) {
      if (r.error === "signed-out") router.push("/sign-in");
      // without a state there's nothing to call next; say so instead of looking paused
      else if (alive.current) (r.error === "offline" ? setOffline : setStalled)(true);
      return null;
    }
    if (alive.current) {
      setState(r.state);
      setStalled(false);
    }
    return r.state;
  }, [id, router]);

  const drive = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    try {
      let s = await load();
      let errors = 0;
      // the answers of one round: a pause, or a stop with Try again after too many errors
      const settle = async (statuses: number[]) => {
        const p = pace(statuses, errors);
        errors = p.errors;
        if (p.stall) {
          if (alive.current) setStalled(true);
          return false;
        }
        if (p.wait) await sleep(p.wait);
        return true;
      };
      while (alive.current && wanted.current && s) {
        if (!navigator.onLine) {
          setOffline(true);
          return;
        }
        // a video batch has no jobs until its video is watched, which makes them
        if (s.watch?.url) {
          const st = await fetch(s.watch.url, { method: "POST" })
            .then((r) => r.status)
            .catch(() => 0);
          if (st === 401) {
            router.push("/sign-in");
            return;
          }
          if (!(await settle([st]))) return;
          s = await load();
          continue;
        }
        const active = s.rows.filter((r) => r.jobStatus === "processing" && r.next.length > 0).slice(0, JOBS_AT_ONCE);
        if (!active.length) break;
        const statuses = await Promise.all(
          active
            .flatMap((r) => r.next)
            .map((c) =>
              fetch(c.url, { method: "POST" })
                .then((r) => r.status)
                .catch(() => 0),
            ),
        );
        if (statuses.includes(401)) {
          router.push("/sign-in");
          return;
        }
        if (!(await settle(statuses))) return;
        s = await load();
      }
    } finally {
      busy.current = false;
      if (alive.current) setRunning(false);
    }
  }, [load, router]);

  useEffect(() => {
    alive.current = true;
    if (wanted.current) void drive();
    const online = () => {
      setOffline(false);
      if (wanted.current) void drive();
    };
    // phones pause a background tab's timers and requests; carry on as soon as it's back
    const visible = () => {
      if (document.visibilityState === "visible" && wanted.current) void drive();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [drive]);

  const resume = useCallback(() => {
    wanted.current = true;
    setPaused(false);
    remember(id, false);
    void drive();
  }, [drive, id]);

  const pause = useCallback(() => {
    wanted.current = false;
    setPaused(true);
    remember(id, true);
  }, [id]);

  // opened again later: carry on, unless it was the seller who paused it. Read after the
  // first render, since the server can't know what this browser remembers.
  useEffect(() => {
    if (autoStart) {
      // a refresh shouldn't count as "just uploaded" again
      router.replace(`/bulk/${id}`, { scroll: false });
      return;
    }
    if (pausedHere(id) || !hasWork(initial)) return;
    const start = setTimeout(resume, 0);
    return () => clearTimeout(start);
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, running, paused, offline, stalled, resume, pause, reload: load };
}

const pauseKey = (id: string) => `listsnap:batch-paused:${id}`;

/** The seller's Pause, kept per batch in this browser; storage can be blocked, which counts as not paused. */
function remember(id: string, paused: boolean) {
  try {
    if (paused) localStorage.setItem(pauseKey(id), "1");
    else localStorage.removeItem(pauseKey(id));
  } catch {}
}

function pausedHere(id: string): boolean {
  try {
    return localStorage.getItem(pauseKey(id)) === "1";
  } catch {
    return false;
  }
}

/** Whether the runner still has calls to make: a video to watch, or a photo with steps left. */
function hasWork(s: BatchState): boolean {
  if (s.watch?.url) return true;
  return s.rows.some((r) => r.jobStatus === "processing" && r.next.length > 0);
}
