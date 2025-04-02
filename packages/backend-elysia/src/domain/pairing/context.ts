import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { postgresContext } from "../../common";
import { pairingTable, webAuthnRequestTable } from "./db/schema";

export const pairingContext = new Elysia({
    name: "Context.pairing",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => {
        const pairingDb = drizzle({
            client: postgresDb,
            schema: {
                pairingTable,
                webAuthnRequestTable,
            },
        });

        return {
            pairingDb,
            ...decorators,
        };
    })
    .as("plugin");

export type PairingContextApp = typeof pairingContext;

export type PairingDb = PostgresJsDatabase<{
    pairingTable: typeof pairingTable;
    webAuthnRequestTable: typeof webAuthnRequestTable;
}>;
