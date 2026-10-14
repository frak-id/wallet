import process from "node:process";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { lightningCssConfig } from "../../dev-tooling/index.ts";

export default defineConfig({
    root: import.meta.dirname,
    css: lightningCssConfig,
    plugins: [react(), vanillaExtractPlugin()],
    build: { outDir: "dist", emptyOutDir: true },
    preview: {
        host: process.env.GALLERY_HOST ?? "127.0.0.1",
        port: Number(process.env.GALLERY_PORT ?? 3200),
        strictPort: true,
    },
});
