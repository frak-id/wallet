import { sessionContext } from "@backend-common";
import { Elysia } from "elysia";
import { authContext } from "../auth";
import { NotificationContext } from "../notifications/context";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(sessionContext)
    .use(authContext)
    .decorate(({ walletJwt, auth }) => {
        const connectionRepository = new PairingConnectionRepository(
            walletJwt,
            auth.services.walletSso,
            auth.services.walletSdkSession
        );
        const routerRepository = new PairingRouterRepository(
            NotificationContext.services.notifications
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
            auth,
        };
    })
    .as("scoped");
