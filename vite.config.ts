import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Identidade desta build. Na Vercel vem o commit; fora dela, o relógio.
// O app compara este valor com o de /version.json para saber que saiu
// versão nova enquanto a janela estava aberta.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? String(Date.now());

/** Publica o build id num arquivo que o app busca de tempos em tempos. */
function versionJson() {
  return {
    name: "version-json",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), versionJson()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Manual vendor chunks to keep initial bundle small and cache stable.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React fica num pedaço só dele, resolvido antes de todos os outros.
          // Se cair junto com bibliotecas que o consomem (cmdk, vaul), os
          // pedaços passam a se importar em círculo e o React chega indefinido
          // na avaliação do radix — tela branca com "forwardRef of undefined".
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "datefns";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          return "vendor";
        },
      },
    },
  },
}));
