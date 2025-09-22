import { sessionContext } from "@backend-common";
import { Elysia } from "elysia";
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
        // Only repositories are created as instances
        const authenticatorRepository = new AuthenticatorRepository();

        return {
            ...decorators,
            auth: {
                repositories: {
                    authenticator: authenticatorRepository,
                },
                // Services are provided by the Elysia extensions above
                services: {
                    walletSdkSession: new WalletSdkSessionService(
                        decorators.walletSdkJwt
                    ),
                    walletSso: new WalletSsoService(),
                    webAuthN: new WebAuthNService(authenticatorRepository),
                },
            },
        };
    })
    .as("scoped");

export type AuthContext = typeof authContext;
