import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";
import { WalletSdkSessionService } from "./services/WalletSdkSessionService";
import { WalletSessionService } from "./services/WalletSessionService";
import { WebAuthNService } from "./services/WebAuthNService";

export namespace AuthContext {
    const authenticatorRepository = new AuthenticatorRepository();
    const walletSdkSessionService = new WalletSdkSessionService();
    const walletSessionService = new WalletSessionService(
        walletSdkSessionService
    );

    export const repositories = {
        authenticator: authenticatorRepository,
    };

    export const services = {
        walletSdkSession: walletSdkSessionService,
        walletSession: walletSessionService,
        webAuthN: new WebAuthNService(authenticatorRepository),
    };
}
