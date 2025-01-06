import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
    },
    server: {
        port: 3012,
    },
    plugins: [reactRouter(), tsconfigPaths()],
});
