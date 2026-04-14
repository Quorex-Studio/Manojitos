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
              if (id.includes('framer-motion')) return 'vendor-framer';
              if (id.includes('@supabase/supabase-js')) return 'vendor-supabase';
              if (id.includes('react-router')) return 'vendor-router';
              if (id.includes('@tanstack/react-query')) return 'vendor-query';
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('date-fns')) return 'vendor-date-fns';
              if (id.includes('zod')) return 'vendor-zod';
              if (id.includes('lucide-react')) return 'vendor-lucide';
              if (id.includes('radix-ui')) return 'vendor-radix';
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
