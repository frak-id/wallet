import { postgresDb } from "@backend-common";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import Elysia from "elysia";
import ky from "ky";
import { AuthenticatorRepository } from "../../domain/auth/repositories/AuthenticatorRepository";
import { fixedRoutingTable, walletRoutingTable } from "./db/schema";
import { SixDegreesAuthenticationService } from "./service/SixDegreesAuthenticationService";
import { SixDegreesInteractionService } from "./service/SixDegreesInteractionService";
import { SixDegreesRoutingService } from "./service/SixDegreesRoutingService";

/**
 * The whole 6degrees context
 */
export const sixDegreesContext = new Elysia({
    name: "Context.6degrees",
}).decorate(() => {
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
        prefixUrl: "https://prodbe-f2m.6degrees.co/",
    });

    // Create the routing service
    const routingService = new SixDegreesRoutingService(db);

    // Create the authentication service
    const authenticationService = new SixDegreesAuthenticationService(
        sixDegreesApi
    );

    // Create the interaction service
    const authenticatorRepository = new AuthenticatorRepository();
    const interactionService = new SixDegreesInteractionService(
        sixDegreesApi,
        authenticatorRepository
    );

    return {
        sixDegrees: {
            db,
            api: sixDegreesApi,
            repositories: {
                authenticator: authenticatorRepository,
            },
            services: {
                authentication: authenticationService,
                interaction: interactionService,
                routing: routingService,
            },
        },
    };
});

export type SixDegreesDb = PostgresJsDatabase<{
    fixedRoutingTable: typeof fixedRoutingTable;
    walletRoutingTable: typeof walletRoutingTable;
}>;
