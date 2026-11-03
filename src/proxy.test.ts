import { describe, expect, it } from "vitest";
import { crossOrigin } from "./proxy";

const req = (path: string, method: string, headers: Record<string, string> = {}) =>
  new Request(`https://getlistsnap.com${path}`, { method, headers: { host: "getlistsnap.com", ...headers } });

describe("calls that change something come from ListSnap's own pages", () => {
  it("lets the app's own requests through", () => {
    expect(crossOrigin(req("/api/listings/l/store", "POST", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(crossOrigin(req("/api/chat", "POST", { origin: "https://getlistsnap.com" }))).toBe(false);
    // no browser, no visitor's cookie: a script or a server
    expect(crossOrigin(req("/api/chat", "POST"))).toBe(false);
  });

  it("refuses another site, and the demo store on a sibling subdomain", () => {
    expect(crossOrigin(req("/api/listings/l/post", "POST", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(crossOrigin(req("/api/listings/l/post", "POST", { "sec-fetch-site": "same-site" }))).toBe(true);
    expect(crossOrigin(req("/api/chat", "POST", { origin: "https://store.getlistsnap.com" }))).toBe(true);
    expect(crossOrigin(req("/api/chat", "POST", { origin: "null" }))).toBe(true);
  });

  it("leaves reads, sign-in and Shopify's signed webhooks alone", () => {
    // Facebook and Shopify send the seller back to these with a cross-site GET
    expect(crossOrigin(req("/api/meta/callback", "GET", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(crossOrigin(req("/api/auth/sign-in/anonymous", "POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(crossOrigin(req("/api/shopify/webhooks", "POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});
