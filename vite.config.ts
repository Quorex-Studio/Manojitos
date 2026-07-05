import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }: { mode: string }) => {
  const isProd = mode === 'production';

  const plugins = [
    react(),
    {
      name: "force-exit",
      closeBundle() {
        if (process.env.VERCEL || process.env.NODE_ENV === "production") {
          setTimeout(() => {
            console.log("Vite build completed. Forcefully exiting the node process...");
            process.exit(0);
          }, 1000);
        }
      },
    },
  ];

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor'; // Agrupar todas las dependencias en un solo chunk mejora el tiempo de build
            }
          },
        }
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        'framer-motion',
      ],
    },
  };
});
