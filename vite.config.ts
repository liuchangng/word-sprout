import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.SPROUT_BASE || "/",
  plugins: [react()],
  server: { port: 5189, strictPort: true },
  preview: { port: 5189, strictPort: true },
});
