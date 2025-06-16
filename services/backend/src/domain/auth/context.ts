import { postgresDb, sessionContext } from "@backend-common";
import { drizzle } from "drizzle-orm/postgres-js";
import { Elysia } from "elysia";
import { ssoTable } from "./db/schema";
import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";
import { WalletSdkSessionService } from "./services/WalletSdkSessionService";
import { WalletSsoService } from "./services/WalletSsoService";
import { WebAuthNService } from "./services/WebAuthNService";

/**
 * Context for the auth domain
 * Note: Auth services are Elysia extensions, not classes, so we use them directly
 */
export const authContext = new Elysia({
    name: "Context.auth",
})
    .use(sessionContext)
    .decorate((decorators) => {
        // Create the db instance
        const db = drizzle({
            client: postgresDb,
            schema: { ssoTable },
        });

        // Only repositories are created as instances
        const authenticatorRepository = new AuthenticatorRepository();

        return {
            ...decorators,
            auth: {
                db,
                repositories: {
                    authenticator: authenticatorRepository,
                },
                // Services are provided by the Elysia extensions above
                services: {
                    walletSdkSession: new WalletSdkSessionService(
                        decorators.walletSdkJwt
                    ),
                    walletSso: new WalletSsoService(db),
                    webAuthN: new WebAuthNService(authenticatorRepository),
                },
            },
        };
    })
    .as("scoped");

export type AuthContext = typeof authContext;
