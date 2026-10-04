// Genera site.webmanifest y robots.txt a partir de las variables VITE_BRAND_* del .env,
// para que cada tienda de la plantilla no tenga que editar archivos estáticos.
import type { Plugin } from "vite";

type Env = Record<string, string>;

// Valores por defecto de la marca: si falta una variable en .env / Vercel, el build
// sigue funcionando (index.html usa %VITE_*% y un placeholder vacío rompe el build).
export const BRAND_ENV_DEFAULTS: Env = {
  VITE_BRAND_NAME: "Manojitos",
  VITE_BRAND_DOMAIN: "manojitos.vercel.app",
  VITE_GTM_ID: "",
};

/**
 * Completa process.env con los valores por defecto que falten (loadEnv los incluye).
 * `fileEnv` = lo que ya trae el .env: Vite le da prioridad a process.env sobre el .env, así que
 * un valor por defecto escrito aquí taparía el del archivo (pasaba con VITE_GTM_ID).
 */
export function applyBrandEnvDefaults(fileEnv: Env = {}): void {
  for (const [key, value] of Object.entries(BRAND_ENV_DEFAULTS)) {
    if (process.env[key] === undefined && fileEnv[key] === undefined) process.env[key] = value;
  }
}

const manifest = (env: Env) =>
  JSON.stringify(
    {
      name: env.VITE_BRAND_NAME || "Manojitos",
      short_name: env.VITE_BRAND_NAME || "Manojitos",
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
  ["User-agent: *", "Allow: /", "", `Host: https://${env.VITE_BRAND_DOMAIN || "manojitos.vercel.app"}`, ""].join("\n");

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
