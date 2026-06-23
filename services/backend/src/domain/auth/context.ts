import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";
import { WalletJwtService } from "./services/WalletJwtService";
import { WalletSdkSessionService } from "./services/WalletSdkSessionService";
import { WebAuthNService } from "./services/WebAuthNService";

export namespace AuthContext {
    const authenticatorRepository = new AuthenticatorRepository();
    const walletSdkSessionService = new WalletSdkSessionService();
    const walletJwtService = new WalletJwtService(walletSdkSessionService);

    export const repositories = {
        authenticator: authenticatorRepository,
    };

    export const services = {
        walletSdkSession: walletSdkSessionService,
        walletJwt: walletJwtService,
        webAuthN: new WebAuthNService(authenticatorRepository),
    };
}
