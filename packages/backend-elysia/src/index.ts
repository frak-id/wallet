import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { isRunningInProd, isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { commonRoutes } from "./common/routes";
import {
    business,
    exampleNewsPaper,
    interactions,
    notifications,
    oracle,
} from "./domain";

// Full on service app
const app = new Elysia()
    .use(log.into())
    .use(cors())
    .onRequest(({ request: { url }, error }) => {
        if (
            !(
                url.includes(process.env.HOSTNAME ?? "") ||
                url.includes("/health")
            )
        ) {
            // If it didn't match our url, simulate a DNS error with 523 to prevent bot from abusing our backend
            log.debug({ url }, "Request didn't target the right hostname");
            return error(523);
        }
    })
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        isProd: isRunningInProd,
        isLocal: isRunningLocally,
    }))
    .use(commonRoutes)
    // Example news paper logics
    .use(exampleNewsPaper)
    // Business logics
    .use(oracle)
    .use(interactions)
    .use(notifications)
    .use(business)
    // Setup bun serve options
    .listen({
        port: Number.parseInt(process.env.PORT ?? "3030"),
    });

// todo: hostname lockup? How to check target pre request?

log.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
