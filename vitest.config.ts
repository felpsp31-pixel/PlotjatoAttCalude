import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // O client do Supabase exige URL e chave; nos testes basta um valor falso.
    env: { VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_PUBLISHABLE_KEY: "chave-de-teste" },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
