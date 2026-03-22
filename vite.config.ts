import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/@tanstack/')) {
            return 'vendor-query';
          }
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/zod/') || id.includes('node_modules/date-fns/') || id.includes('node_modules/clsx/') || id.includes('node_modules/tailwind-merge/')) {
            return 'vendor-utils';
          }
          if (id.includes('node_modules/xlsx/')) {
            return 'vendor-xlsx';
          }
          if (id.includes('/src/pages/Dashboard') || id.includes('/src/pages/Products') || id.includes('/src/pages/Sales') || id.includes('/src/pages/Credits') || id.includes('/src/pages/Debts') || id.includes('/src/pages/Reports') || id.includes('/src/pages/ImportProducts') || id.includes('/src/pages/Providers') || id.includes('/src/pages/PriceCalculator') || id.includes('/src/pages/BusinessRules')) {
            return 'pages-admin';
          }
          if (id.includes('/src/pages/StoreFront') || id.includes('/src/pages/StoreCatalog') || id.includes('/src/pages/ProductDetail') || id.includes('/src/pages/Cart') || id.includes('/src/pages/Checkout')) {
            return 'pages-store';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
}));
