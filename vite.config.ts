import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }: { mode: string }) => {
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
  };
});
