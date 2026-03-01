import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const siteUrl = (process.env.VITE_SITE_URL || "http://localhost:5173").replace(/\/+$/, "");
const publicDir = resolve(import.meta.dirname, "../public");
const routes = ["/"];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${new URL(route, `${siteUrl}/`).toString()}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === "/" ? "1.0" : "0.6"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, "sitemap.xml"), sitemap);
writeFileSync(resolve(publicDir, "robots.txt"), robots);
