import { mock } from "bun:test";
import type { LocalAccount } from "viem";
import { viemMocks } from "./viem";
import postgres from "postgres";

/* -------------------------------------------------------------------------- */
/*                                     Env                                    */
/* -------------------------------------------------------------------------- */

Object.assign(process.env, {
    JWT_SECRET: "secret",
    JWT_SDK_SECRET: "secret",
    PRODUCT_SETUP_CODE_SALT: "salt",
    MASTER_KEY_SECRET: JSON.stringify({ masterPrivateKey: "123456" }),
});

/* -------------------------------------------------------------------------- */
/*                               Backend commons                              */
/* -------------------------------------------------------------------------- */

export const indexerApiMocks = {
    get: mock(() => ({
        json: mock(() => Promise.resolve({})),
    })),
};

export const pricingRepositoryMocks = {
    getTokenPrice: mock(() =>
        Promise.resolve({ eur: 1.2, usd: 1.0, gbp: 0.8 })
    ),
};

export const adminWalletsRepositoryMocks = {
    getKeySpecificAccount: mock(() =>
        Promise.resolve(undefined as undefined | LocalAccount)
    ),
    getMutexForAccount: mock(() => ({
        runExclusive: mock((fn: () => Promise<unknown>) => fn()),
    })),
};

export const interactionDiamondRepositoryMocks = {
    getInteractionDiamond: mock(() => Promise.resolve(undefined)),
}

export const rolesRepositoryMocks = {
    getRoles: mock(() => Promise.resolve([])),
}

mock.module("@backend-common", () => ({
    indexerApi: indexerApiMocks,
    pricingRepository: pricingRepositoryMocks,
    viemClient: viemMocks,
    adminWalletsRepository: adminWalletsRepositoryMocks,
    interactionDiamondRepository: interactionDiamondRepositoryMocks,
    rolesRepository: rolesRepositoryMocks,
    log: {
        debug: mock(() => {}),
        info: mock(() => {}),
        error: mock(() => {}),
        warn: mock(() => {}),
    },
    eventEmitter: {
        emit: mock(() => {}),
        on: mock(() => {}),
        off: mock(() => {}),
    },
}));

/* -------------------------------------------------------------------------- */
/*                                   Webpush                                  */
/* -------------------------------------------------------------------------- */

export const webPushMocks = {
    sendNotification: mock(() => Promise.resolve()),
    setVapidDetails: mock(() => {}),
};
mock.module("web-push", () => webPushMocks);
