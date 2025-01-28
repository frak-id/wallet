import { postgresContext } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import Elysia from "elysia";
import ky from "ky";
import { fixedRoutingTable, walletRoutingTable } from "./db/schema";
import { SixDegreesAuthenticationService } from "./service/SixDegreesAuthenticationService";
import { SixDegreesInteractionService } from "./service/SixDegreesInteractionService";
import { SixDegreesRoutingService } from "./service/SixDegreesRoutingService";

/**
 * The whole 6degrees context
 */
export const sixDegreesContext = new Elysia({
    name: "Context.6degrees",
})
    .use(postgresContext)
    .decorate(({ postgresDb, ...decorators }) => {
        // Create the 6degrees db
        const db = drizzle({
            client: postgresDb,
            schema: {
                fixedRoutingTable,
                walletRoutingTable,
            },
        });

        // Build the ky api that will be used to interact with 6degrees
        const sixDegreesApi = ky.create({
            prefixUrl: "https://api.6degrees.xyz",
        });

        // Create the routing service
        const routingService = new SixDegreesRoutingService(db);

        // Create the authentication service
        const authenticationService = new SixDegreesAuthenticationService(
            sixDegreesApi
        );

        // Create the interaction service
        const interactionService = new SixDegreesInteractionService(
            sixDegreesApi
        );

        return {
            ...decorators,
            sixDegrees: {
                db,
                api: sixDegreesApi,
                authenticationService,
                interactionService,
                routingService,
            },
        };
    });

export type SixDegreesDb = PostgresJsDatabase<{
    fixedRoutingTable: typeof fixedRoutingTable;
    walletRoutingTable: typeof walletRoutingTable;
}>;
