import { describe, expect, it } from "vitest";
import { callSummary, errorText, parseStoredError, storedError, text } from "./step-text";

describe("step text", () => {
  it("shows a stored step error in the seller's language", () => {
    const stored = storedError("productChanged", { differences: "gold became silver" });
    expect(errorText(stored, "en")).toBe(
      "The AI photo changed your product (gold became silver), so it wasn't kept. Try again for a new one; your other photos are ready.",
    );
    expect(errorText(stored, "bn")).toContain("AI ছবিতে আপনার পণ্য বদলে গেছে (gold became silver)");
  });

  it("shows an error written before keys existed as it is", () => {
    expect(errorText("The photo file is missing.", "bn")).toBe("The photo file is missing.");
    expect(parseStoredError('{"key":"notARealKey"}')).toBeNull();
  });

  it("writes step details with Bangla digits and plurals in Bangla", () => {
    const found = { count: 3, phrase: "kurti", fill: 80 };
    expect(text("en", "stepText.details.found", found)).toBe('3 items for "kurti" · fills 80% of the frame');
    expect(text("en", "stepText.details.found", { ...found, count: 1 })).toBe(
      '1 item for "kurti" · fills 80% of the frame',
    );
    expect(text("bn", "stepText.details.found", found)).toBe('"kurti"-এর জন্য ৩টি জিনিস · ফ্রেমের ৮০% জুড়ে আছে');
  });

  it("shows a failed call as the seller's words, never a raw message", () => {
    expect(callSummary(true, "reel to Rupkotha · 120 chars", "en")).toBe("reel to Rupkotha · 120 chars");
    expect(callSummary(false, storedError("metaBusy"), "en")).toBe(
      "Facebook is limiting posts right now. Try again in a few minutes.",
    );
    // a row from before: an HTML error page, or ffmpeg's output
    const raw = callSummary(false, "HTTP 502: <html><body>Bad gateway</body></html>", "en");
    expect(raw).toBe(text("en", "stepText.errors.generic"));
    expect(callSummary(false, null, "bn")).toBe(text("bn", "stepText.errors.generic"));
  });
});
