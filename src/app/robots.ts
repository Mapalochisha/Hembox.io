import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/portal",
        "/api",
        "/auth",
        "/login",
        "/register",
        "/profile",
        "/access-denied",
      ],
    },
    sitemap: "https://hembox.tech/sitemap.xml",
  };
}
