// import { viteCommonjs } from "@originjs/vite-plugin-commonjs";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    server: {
        port: 3013,
    },
    plugins: [remix() /*,  viteCommonjs()*/, tsconfigPaths()],
    build: { target: 'ES2022' },
});
