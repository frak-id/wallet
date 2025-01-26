import { postgresContext } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import Elysia from "elysia";
import { fixedRoutingTable, walletRoutingTable } from "./db/schema";
import { SixDegreesRoutingService } from "./service/SixDegreesRoutingService";

export const sixDegreesRoutingContext = new Elysia({
    name: "Context.6degreesRouting",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...other }) => {
        // Create the 6degrees db
        const sixDegreesDb = drizzle({
            client: postgresDb,
            schema: {
                fixedRoutingTable,
                walletRoutingTable,
            },
        });

        // Create the routing service
        const routingService = new SixDegreesRoutingService(sixDegreesDb);

        // Return the routing specific
        return {
            ...other,
            postgresDb,
            sixDegreesDb,
            sixDegreesRouting: routingService,
        };
    });

export type SixDegreesDb = PostgresJsDatabase<{
    fixedRoutingTable: typeof fixedRoutingTable;
    walletRoutingTable: typeof walletRoutingTable;
}>;
