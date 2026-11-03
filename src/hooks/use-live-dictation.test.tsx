// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveDictation } from "./use-live-dictation";

/**
 * The microphone is let go whatever the seller does while the browser asks for it: a
 * second tap, or leaving the page before answering the prompt.
 */
let grant: (stream: MediaStream) => void;
let asks = 0;
const stopped: string[] = [];
const fakeStream = (name: string) =>
  ({ getTracks: () => [{ stop: () => stopped.push(name) }] }) as unknown as MediaStream;

beforeEach(() => {
  asks = 0;
  stopped.length = 0;
  vi.stubGlobal(
    "MediaRecorder",
    Object.assign(
      class {
        state = "inactive";
        mimeType = "audio/webm";
        ondataavailable = null;
        onstop = null;
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
        }
      },
      { isTypeSupported: () => true },
    ),
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () => {
        asks++;
        return new Promise<MediaStream>((r) => (grant = r));
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const hook = () =>
  renderHook(() => useLiveDictation({ onWords: () => {}, onDone: () => {}, onFail: () => {}, writeDown: false }));

describe("microphone while the permission prompt is up", () => {
  it("ignores a second tap, and says it is starting meanwhile", async () => {
    const { result } = hook();
    let first!: Promise<boolean>;
    act(() => {
      first = result.current.start();
    });
    expect(result.current.phase).toBe("starting");
    let second!: boolean;
    await act(async () => {
      second = await result.current.start();
    });
    expect(second).toBe(false);
    expect(asks).toBe(1);

    await act(async () => {
      grant(fakeStream("first"));
      expect(await first).toBe(true);
    });
    expect(result.current.phase).toBe("listening");
  });

  it("lets go of a microphone granted after the page went away", async () => {
    const { result, unmount } = hook();
    let started!: Promise<boolean>;
    act(() => {
      started = result.current.start();
    });
    unmount();
    grant(fakeStream("late"));
    expect(await started).toBe(false);
    expect(stopped).toEqual(["late"]);
  });
});
