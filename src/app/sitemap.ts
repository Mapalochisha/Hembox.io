import type { MetadataRoute } from "next";

const publicPages = ["", "/about", "/domains", "/pricing", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({
    url: `https://hembox.tech${path}`,
  }));
}
