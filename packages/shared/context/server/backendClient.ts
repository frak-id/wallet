"use client";

import { treaty } from "@elysiajs/eden";
import type { App } from "@frak-labs/backend-elysia";

export const backendApi = treaty<App>(
    process.env.BACKEND_URL ?? "http://localhost:3030",
    {
        fetch: {
            credentials: "include",
        },
    }
);
