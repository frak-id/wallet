import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getEnv } from "@module/utils/getEnv";

const BACKEND_URL =
    typeof process !== "undefined"
        ? process?.env?.BACKEND_URL ?? "http://localhost:3030"
        : getEnv()?.BACKEND_URL ?? "http://localhost:3030";

export const backendApi = treaty<App>(BACKEND_URL, {
    fetch: { credentials: "include" },
});
