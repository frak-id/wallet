import tailwindcss from "@tailwindcss/vite";
import tanstackRouter from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
    },
    server: {
        port: 3003,
        proxy: {},
    },
    plugins: [
        tanstackRouter({
            routesDirectory: "./app/routes",
            generatedRouteTree: "./app/routeTree.gen.ts",
            autoCodeSplitting: true,
        }),
        viteReact(),
        tailwindcss(),
        tsconfigPaths(),
    ],
});
