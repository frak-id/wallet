import { postgresDb, sessionContext } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { authContext } from "../auth";
import { notificationContext } from "../notifications/context";
import { pairingSignatureRequestTable, pairingTable } from "./db/schema";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(sessionContext)
    .use(authContext)
    .use(notificationContext)
    .decorate(({ walletJwt, auth, notifications }) => {
        const pairingDb = drizzle({
            client: postgresDb,
            schema: {
                pairingTable,
                pairingSignatureRequestTable,
            },
        });

        const connectionRepository = new PairingConnectionRepository(
            pairingDb,
            walletJwt,
            auth.services.walletSso,
            auth.services.walletSdkSession
        );
        const routerRepository = new PairingRouterRepository(
            pairingDb,
            notifications.services.notifications
        );

        return {
            pairing: {
                db: pairingDb,
                repositories: {
                    connection: connectionRepository,
                    router: routerRepository,
                },
            },
            // Decorators
            postgresDb,
            walletJwt,
            notifications,
            auth,
        };
    })
    .as("scoped");

export type PairingContextApp = typeof pairingContext;

export type PairingDb = PostgresJsDatabase<{
    pairingTable: typeof pairingTable;
    pairingSignatureRequestTable: typeof pairingSignatureRequestTable;
}>;
