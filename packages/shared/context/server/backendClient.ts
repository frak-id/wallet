import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getEnv } from "@module/utils/getEnv";

export const backendApi = treaty<App>(
    process?.env?.BACKEND_URL ??
        getEnv()?.BACKEND_URL ??
        "http://localhost:3030",
    {
        fetch: { credentials: "include" },
    }
);
