import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 3014,
    },
    plugins: [sveltekit()],
});
