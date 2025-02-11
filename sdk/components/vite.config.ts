import preact from "@preact/preset-vite";
import browserslistToEsbuild from "browserslist-to-esbuild";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    build: {
        lib: {
            entry: "src/components.ts",
            name: "FrakComponents",
            formats: ["umd"],
            fileName: () => "components.js",
        },
        target: browserslistToEsbuild(),
        outDir: "cdn",
    },
    plugins: [preact(), svgr(), tsconfigPaths()],
});
