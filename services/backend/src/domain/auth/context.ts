import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";
import { WalletSdkSessionService } from "./services/WalletSdkSessionService";
import { WalletSsoService } from "./services/WalletSsoService";
import { WebAuthNService } from "./services/WebAuthNService";

/**
 * Context for the auth domain
 */
export namespace AuthContext {
    // Only repositories are created as instances
    const authenticatorRepository = new AuthenticatorRepository();

    export const repositories = {
        authenticator: authenticatorRepository,
    };
    // Services are provided by the Elysia extensions above
    export const services = {
        walletSdkSession: new WalletSdkSessionService(),
        walletSso: new WalletSsoService(),
        webAuthN: new WebAuthNService(authenticatorRepository),
    };
}
