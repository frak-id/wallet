import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { postgresContext, sessionContext } from "../../common";
import { walletSdkSessionService } from "../auth/services/WalletSdkSessionService";
import { walletSsoService } from "../auth/services/WalletSsoService";
import { notificationContext } from "../notifications/context";
import { pairingSignatureRequestTable, pairingTable } from "./db/schema";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(postgresContext)
    .use(sessionContext)
    .use(walletSdkSessionService)
    .use(walletSsoService)
    .use(notificationContext)
    .decorate(
        ({
            postgresDb,
            generateSdkJwt,
            walletJwt,
            ssoService,
            notification,
            ...decorators
        }) => {
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
                ssoService,
                generateSdkJwt
            );
            const routerRepository = new PairingRouterRepository(
                pairingDb,
                notification.service
            );

            return {
                pairing: {
                    db: pairingDb,
                    connectionRepository: connectionRepository,
                    routerRepository: routerRepository,
                },
                // Decorators
                postgresDb,
                generateSdkJwt,
                walletJwt,
                ssoService,
                notification,
                ...decorators,
            };
        }
    )
    .as("plugin");

export type PairingContextApp = typeof pairingContext;

export type PairingDb = PostgresJsDatabase<{
    pairingTable: typeof pairingTable;
    pairingSignatureRequestTable: typeof pairingSignatureRequestTable;
}>;
