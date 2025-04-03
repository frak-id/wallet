import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { postgresContext } from "../../common";
import { pairingSignatureRequestTable, pairingTable } from "./db/schema";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const pairingDb = drizzle({
            client: postgresDb,
            schema: {
                pairingTable,
                pairingSignatureRequestTable,
            },
        });

        const connectionRepository = new PairingConnectionRepository(pairingDb);
        const routerRepository = new PairingRouterRepository(pairingDb);

        return {
            pairing: {
                db: pairingDb,
                connectionRepository: connectionRepository,
                routerRepository: routerRepository,
            },
            ...decorators,
        };
    })
    .as("plugin");

export type PairingContextApp = typeof pairingContext;

export type PairingDb = PostgresJsDatabase<{
    pairingTable: typeof pairingTable;
    pairingSignatureRequestTable: typeof pairingSignatureRequestTable;
}>;
