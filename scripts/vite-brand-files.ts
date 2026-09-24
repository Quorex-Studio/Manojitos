// Genera site.webmanifest y robots.txt a partir de las variables VITE_BRAND_* del .env,
// para que cada tienda de la plantilla no tenga que editar archivos estáticos.
import type { Plugin } from "vite";

type Env = Record<string, string>;

const manifest = (env: Env) =>
  JSON.stringify(
    {
      name: env.VITE_BRAND_NAME || "EINA",
      short_name: env.VITE_BRAND_NAME || "EINA",
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: env.VITE_BRAND_THEME_COLOR || "#D4AF37",
      background_color: env.VITE_BRAND_BACKGROUND_COLOR || "#faf8f5",
      display: "standalone",
      start_url: "/",
    },
    null,
    4,
  );

const robots = (env: Env) =>
  ["User-agent: *", "Allow: /", "", `Host: https://${env.VITE_BRAND_DOMAIN || "einashopv.com"}`, ""].join("\n");

export function brandFiles(env: Env): Plugin {
  const files: Record<string, { type: string; body: () => string }> = {
    "/site.webmanifest": { type: "application/manifest+json", body: () => manifest(env) },
    "/robots.txt": { type: "text/plain", body: () => robots(env) },
  };
  return {
    name: "brand-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url && files[req.url.split("?")[0]];
        if (!file) return next();
        res.setHeader("Content-Type", file.type);
        res.end(file.body());
      });
    },
    generateBundle() {
      for (const [path, file] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: file.body() });
      }
    },
  };
}
