import { AuthenticatorRepository } from "./repositories/AuthenticatorRepository";
import { MobileAuthCodeService } from "./services/MobileAuthCodeService";
import { WalletSdkSessionService } from "./services/WalletSdkSessionService";
import { WebAuthNService } from "./services/WebAuthNService";

export namespace AuthContext {
    const authenticatorRepository = new AuthenticatorRepository();
    const walletSdkSessionService = new WalletSdkSessionService();

    export const repositories = {
        authenticator: authenticatorRepository,
    };

    export const services = {
        walletSdkSession: walletSdkSessionService,
        webAuthN: new WebAuthNService(authenticatorRepository),
        mobileAuthCode: new MobileAuthCodeService(walletSdkSessionService),
    };
}
