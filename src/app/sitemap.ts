import type { MetadataRoute } from "next";
import { env } from "@/server/env";

const PAGES = ["", "/pricing", "/privacy", "/terms", "/data-deletion"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({ url: `${env().siteUrl}${page}` }));
}
