import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://hembox.tech";
const STATIC_PUBLIC_PATHS = ["/", "/about", "/domains", "/privacy", "/terms"];
const REDIRECT_ONLY_SLUGS = new Set([
  "sme-website-starter",
  "sme-website-professional",
]);

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
  }));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("services")
      .select("slug")
      .eq("status", "active")
      .not("slug", "is", null);

    if (error) throw error;

    const serviceSlugs = Array.from(
      new Set(
        (data ?? [])
          .map((service) => service.slug)
          .filter(
            (slug): slug is string =>
              typeof slug === "string" &&
              slug.length > 0 &&
              !REDIRECT_ONLY_SLUGS.has(slug),
          ),
      ),
    );

    return [
      ...staticEntries,
      ...serviceSlugs.map((slug) => ({
        url: `${SITE_URL}/services/${encodeURIComponent(slug)}`,
      })),
    ];
  } catch (error) {
    console.error("Unable to load active services for sitemap:", error);
    return staticEntries;
  }
}
