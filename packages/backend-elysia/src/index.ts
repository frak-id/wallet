import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { commonRoutes } from "./common/routes";
import {
    auth,
    business,
    exampleNewsPaper,
    interactions,
    notifications,
    oracle,
    wallet,
} from "./domain";

// Full on service app
const app = new Elysia({
    aot: true,
    precompile: true,
})
    .use(
        log.into({
            autoLogging: isRunningLocally,
        })
    )
    .use(cors())
    .onRequest(({ request: { url }, error }) => {
        if (
            !(
                url.includes(process.env.HOSTNAME ?? "") ||
                url.includes("/health")
            )
        ) {
            // If it didn't match our url, simulate a DNS error with 523 to prevent bot from abusing our backend
            return error(523);
        }
    })
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        stage: process.env.STAGE,
    }))
    .use(commonRoutes)
    // Example news paper logics
    .guard({}, (app) => app.use(exampleNewsPaper))
    // Business logics
    .use(auth)
    .use(oracle)
    .use(interactions)
    .use(notifications)
    .use(wallet)
    .use(business)
    // Setup bun serve options
    .listen({
        port: Number.parseInt(process.env.PORT ?? "3030"),
    });

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
