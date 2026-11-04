import type { MetadataRoute } from "next";
import { env } from "@/server/env";

/** Only the public pages are for search engines; the app is behind sign-in anyway. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/media/", "/job/", "/bulk/", "/assistant/", "/connections/", "/onboarding/"],
    },
    sitemap: `${env().siteUrl}/sitemap.xml`,
  };
}
