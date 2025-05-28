import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";

const baseUrl = process.env.BACKEND_URL ?? "http://localhost:3030";

export const backendApi = treaty<App>(baseUrl, {
    fetch: { credentials: "include" },
});
export const businessApi = backendApi.business;
