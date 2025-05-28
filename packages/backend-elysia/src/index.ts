import { log } from "@backend-common";
import { cors } from "@elysiajs/cors";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { Elysia, error, redirect } from "elysia";
import { businessApi } from "./api/business";
import { commonApi } from "./api/common";
import { externalApi } from "./api/external";
import { walletApi } from "./api/wallet";
import { jobs } from "./jobs";

// Full on service app
const app = new Elysia({
    aot: true,
    precompile: true,
    // Websocket specific config
    websocket: {
        // Idle timeout of 5min in seconds, could take a long time for a pairing to be resolved
        idleTimeout: 300,
    },
})
    .use(
        log.into({
            autoLogging: isRunningLocally,
        })
    )
    .use(
        cors({
            methods: ["DELETE", "GET", "POST", "PUT", "PATCH"],
        })
    )
    .get("/health", () => ({
        status: "ok",
        hostname: process.env.HOSTNAME,
        stage: process.env.STAGE,
    }))
    .use(commonApi)
    .use(businessApi)
    .use(walletApi)
    .use(externalApi)
    // All the jobs
    .use(jobs)
    // Finally, the legacy route mapper routes
    .all("*", ({ path }) => {
        // Redirect previous domain based routes to the new ones

        // Handle interactions related routes
        if (path.startsWith("/interactions/webhook/")) {
            const productId = path.split("/")[3];
            const action = path.split("/")[4];
            log.debug(
                { path, productId, action },
                "Redirecting to new interactions routes"
            );
            return redirect(
                `/ext/products/${productId}/webhook/interactions/${action}`,
                308
            );
        }

        // Handle listen for purchase
        // interactions/listenForPurchase -> wallet/interactions/listenForPurchase
        if (path.startsWith("/interactions/listenForPurchase")) {
            log.debug({ path }, "Redirecting to new listen for purchase route");
            return redirect("/wallet/interactions/listenForPurchase", 308);
        }

        // Handle oracle routes
        // oracle/listenForPurchase -> wallet/oracle/listenForPurchase
        if (path.startsWith("/oracle") && path.endsWith("/hook")) {
            const type = path.split("/")[2];
            const productId = path.split("/")[3];
            log.debug(
                {
                    path,
                    productId,
                    type,
                },
                "Redirecting to new oracle webhook route"
            );
            return redirect(
                `/ext/products/${productId}/webhook/oracle/${type}`,
                308
            );
        }

        // Handle unknown routes
        return error(404, "Not found");
    })
    // Setup bun serve options
    .listen({
        port: Number.parseInt(process.env.PORT ?? "3030"),
    });

log.info(`Running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

export type BusinessApp = typeof businessApi;
export type WalletApp = typeof walletApi;
export type CommonApp = typeof commonApi;
