import { AuthContext } from "../auth";
import { NotificationContext } from "../notifications/context";
import { PairingConnectionRepository } from "./repositories/PairingConnectionRepository";
import { PairingRouterRepository } from "./repositories/PairingRouterRepository";

export namespace PairingContext {
    const connectionRepository = new PairingConnectionRepository(
        AuthContext.services.walletSdkSession
    );
    const routerRepository = new PairingRouterRepository(
        NotificationContext.services.notifications
    );

    export const repositories = {
        connection: connectionRepository,
        router: routerRepository,
    };
}
