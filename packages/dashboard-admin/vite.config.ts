import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
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
    plugins: [reactRouter(), tailwindcss(), tsconfigPaths()],
});
