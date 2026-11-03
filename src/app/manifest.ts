import type { MetadataRoute } from "next";

/**
 * "Add to Home screen" opens ListSnap like an app: its own icon and name, no browser bar,
 * straight into the Dashboard (sign-in sends a signed-out seller there first).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ListSnap",
    short_name: "ListSnap",
    description: "One phone photo in. A store draft, studio photos and a reel out.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#0e7357",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
