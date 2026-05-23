import { AuthContext } from "../auth";
import { IdentityContext } from "../identity";
import { NotificationContext } from "../notifications/context";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export namespace PairingContext {
    const connectionRepository = new PairingConnectionRepository(
        AuthContext.services.walletSdkSession,
        AuthContext.repositories.authenticator,
        IdentityContext.repositories.walletBinding
    );
    const routerRepository = new PairingRouterRepository(
        NotificationContext.services.notifications
    );

    export const repositories = {
        connection: connectionRepository,
        router: routerRepository,
    };
}
