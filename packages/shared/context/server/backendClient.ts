import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";
import { getEnv } from "@module/utils/getEnv";

const env = getEnv();

export const backendApi = treaty<App>(
    env?.BACKEND_URL ?? "http://localhost:3030",
    {
        fetch: { credentials: "include" },
    }
);
