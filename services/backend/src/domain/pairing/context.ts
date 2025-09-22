import { sessionContext } from "@backend-common";
import { Elysia } from "elysia";
import { authContext } from "../auth";
import { notificationContext } from "../notifications/context";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(sessionContext)
    .use(authContext)
    .use(notificationContext)
    .decorate(({ walletJwt, auth, notifications }) => {
        const connectionRepository = new PairingConnectionRepository(
            walletJwt,
            auth.services.walletSso,
            auth.services.walletSdkSession
        );
        const routerRepository = new PairingRouterRepository(
            notifications.services.notifications
        );

        return {
            pairing: {
                repositories: {
                    connection: connectionRepository,
                    router: routerRepository,
                },
            },
            // Decorators
            walletJwt,
            notifications,
            auth,
        };
    })
    .as("scoped");
