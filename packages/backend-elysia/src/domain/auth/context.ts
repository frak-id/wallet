import { getMongoDb } from "@backend-common";
import type Elysia from "elysia";
import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";

/**
 * Elysia plugin with the news paper context
 */
export async function authContext(app: Elysia) {
    // Get the db repositories
    const db = await getMongoDb({
        urlKey: "MONGODB_NEXUS_URI",
        db: "nexus",
    });
    const authenticatorDbRepository = new AuthenticatorRepository(db);

    // Decorate the app
    return app.decorate({
        authenticatorDbRepository,
    });
}
