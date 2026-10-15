import { adminWalletsRepository } from "@backend-infrastructure";
import { MoneriumConnectionRepository } from "./repositories/MoneriumConnectionRepository";
import { MoneriumPendingAuthRepository } from "./repositories/MoneriumPendingAuthRepository";
import { MoneriumTrackedOrderRepository } from "./repositories/MoneriumTrackedOrderRepository";
import { MoneriumApiClient } from "./services/MoneriumApiClient";
import { MoneriumAuthService } from "./services/MoneriumAuthService";
import { MoneriumLinkService } from "./services/MoneriumLinkService";
import { MoneriumOrderService } from "./services/MoneriumOrderService";
import { MoneriumStatusService } from "./services/MoneriumStatusService";
import { MoneriumTokenCipher } from "./services/MoneriumTokenCipher";
import { MoneriumTokenService } from "./services/MoneriumTokenService";

const connectionRepository = new MoneriumConnectionRepository();
const pendingAuthRepository = new MoneriumPendingAuthRepository();
const trackedOrderRepository = new MoneriumTrackedOrderRepository();

const cipher = new MoneriumTokenCipher(adminWalletsRepository);
const apiClient = new MoneriumApiClient(fetch);
const tokenService = new MoneriumTokenService(
    connectionRepository,
    cipher,
    apiClient
);
const statusService = new MoneriumStatusService(
    connectionRepository,
    tokenService,
    apiClient
);
const authService = new MoneriumAuthService(
    connectionRepository,
    pendingAuthRepository,
    trackedOrderRepository,
    cipher,
    apiClient,
    statusService
);
const linkService = new MoneriumLinkService(
    connectionRepository,
    tokenService,
    apiClient,
    statusService
);
const orderService = new MoneriumOrderService(
    connectionRepository,
    trackedOrderRepository,
    tokenService,
    apiClient,
    statusService
);

export namespace MoneriumContext {
    export const rateLimitPause = apiClient.rateLimitPause;
    export const repositories = {
        connection: connectionRepository,
        pendingAuth: pendingAuthRepository,
        trackedOrder: trackedOrderRepository,
    };
    export const services = {
        auth: authService,
        status: statusService,
        link: linkService,
        orders: orderService,
    };
}
