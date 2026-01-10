import { Elysia, t } from "elysia";
import type { Address, LocalAccount } from "viem";
import { vi } from "vitest";
import { viemMocks } from "./viem";

/* -------------------------------------------------------------------------- */
/*                            Infrastructure Mocks                            */
/* -------------------------------------------------------------------------- */

export const indexerApiMocks = {
    get: vi.fn(() => ({
        json: vi.fn(() => Promise.resolve({})),
    })),
    post: vi.fn(() => ({
        json: vi.fn(() => Promise.resolve({})),
    })),
};

export const pricingRepositoryMocks = {
    getTokenPrice: vi.fn(() =>
        Promise.resolve({ eur: 1.2, usd: 1.0, gbp: 0.8 })
    ),
};

export const adminWalletsRepositoryMocks = {
    getKeySpecificAccount: vi.fn(() =>
        Promise.resolve(undefined as undefined | LocalAccount)
    ),
    getProductSpecificAccount: vi.fn(() =>
        Promise.resolve(undefined as undefined | LocalAccount)
    ),
    getMutexForAccount: vi.fn(() => ({
        runExclusive: vi.fn((fn: () => Promise<unknown>) => fn()),
    })),
};

export const rolesRepositoryMocks = {
    getRoles: vi.fn(() => Promise.resolve([])),
};

export const JwtContextMock = {
    wallet: {
        sign: vi.fn(() => Promise.resolve("mock-jwt-token")),
        verify: vi.fn(() => Promise.resolve({ wallet: "0x123" })),
    },
    walletSdk: {
        sign: vi.fn(() => Promise.resolve("mock-sdk-jwt-token")),
        verify: vi.fn(() => Promise.resolve({ wallet: "0x123" })),
    },
    business: {
        sign: vi.fn(() => Promise.resolve("mock-business-jwt-token")),
        verify: vi.fn(() => Promise.resolve({ wallet: "0x123" })),
    },
};

/**
 * Flexible database mock for Drizzle ORM.
 * Use __setSelectResponse, __setInsertResponse, etc. to configure responses.
 * Use __reset() to clear all configurations.
 */
const mockFunctions = {
    selectMockFn: () => Promise.resolve([]),
    insertMockFn: () => Promise.resolve([]),
    updateMockFn: () => Promise.resolve([]),
    deleteMockFn: () => Promise.resolve([]),
    findManyMockFn: () => Promise.resolve([]),
};

const deleteExecuteMock = vi.fn(() => mockFunctions.deleteMockFn());
// biome-ignore lint/suspicious/noExplicitAny: Mock typing
const transactionMock = vi.fn(async (fn: any) => fn(dbMock));
// biome-ignore lint/suspicious/noExplicitAny: Mock typing
const updateMock = vi.fn((_table?: any) => ({
    set: vi.fn(() => ({
        where: vi.fn(() => ({
            returning: vi.fn(() => mockFunctions.updateMockFn()),
            // biome-ignore lint/suspicious/noThenProperty: Promise-like mock
            then: (onfulfilled?: (value: unknown) => unknown) =>
                mockFunctions.updateMockFn().then(onfulfilled),
        })),
    })),
}));

const createThenable = (
    promiseFn: () => Promise<unknown>,
    chainMethods: Record<string, unknown> = {}
) => ({
    // biome-ignore lint/suspicious/noThenProperty: Promise-like mock
    then: (
        onfulfilled?: (value: unknown) => unknown,
        onrejected?: (reason: unknown) => unknown
    ) => promiseFn().then(onfulfilled, onrejected),
    catch: (onrejected?: (reason: unknown) => unknown) =>
        promiseFn().catch(onrejected),
    finally: (onfinally?: () => void) => promiseFn().finally(onfinally),
    ...chainMethods,
});

export const dbMock = {
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn((_condition?: unknown) => {
                const chainable = {
                    limit: vi.fn((_count?: number) =>
                        mockFunctions.selectMockFn()
                    ),
                    execute: vi.fn(() => mockFunctions.selectMockFn()),
                    innerJoin: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn(() => mockFunctions.selectMockFn()),
                        })),
                    })),
                };
                return createThenable(
                    () => mockFunctions.selectMockFn(),
                    chainable
                );
            }),
            innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(() => mockFunctions.selectMockFn()),
                })),
            })),
            limit: vi.fn(() => mockFunctions.selectMockFn()),
        })),
    })),
    insert: vi.fn(() => ({
        values: vi.fn(() => ({
            returning: vi.fn(() => mockFunctions.insertMockFn()),
            onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn(() => mockFunctions.insertMockFn()),
            })),
            onConflictDoNothing: vi.fn(() => ({
                returning: vi.fn(() => mockFunctions.insertMockFn()),
            })),
        })),
    })),
    update: updateMock,
    delete: vi.fn(() => ({
        where: vi.fn(() => {
            // Make it callable directly (returns promise) or with .execute()
            const deleteResult = () => mockFunctions.deleteMockFn();
            return Object.assign(deleteResult, {
                execute: deleteExecuteMock,
                // biome-ignore lint/suspicious/noThenProperty: mocked stuff
                then: (onfulfilled?: (value: unknown) => unknown) => {
                    deleteExecuteMock();
                    const promise = mockFunctions.deleteMockFn();
                    return promise.then(onfulfilled);
                },
            });
        }),
    })),
    transaction: transactionMock,
    query: {
        purchaseStatusTable: {
            findMany: vi.fn((_opts?: unknown) =>
                mockFunctions.findManyMockFn()
            ),
        },
        pushTokensTable: {
            findMany: vi.fn((_opts?: unknown) =>
                mockFunctions.findManyMockFn()
            ),
            findFirst: vi.fn((_opts?: unknown) => {
                // findFirst returns a single item or undefined
                const result = mockFunctions.selectMockFn();
                return result.then((items: unknown[]) =>
                    items.length > 0 ? items[0] : undefined
                );
            }),
        },
        pairingTable: {
            findMany: vi.fn((_opts?: unknown) =>
                mockFunctions.findManyMockFn()
            ),
            findFirst: vi.fn((_opts?: unknown) => {
                // findFirst returns a single item or undefined
                const result = mockFunctions.selectMockFn();
                return result.then((items: unknown[]) =>
                    items.length > 0 ? items[0] : undefined
                );
            }),
        },
        backendTrackerTable: {
            findFirst: vi.fn((_opts?: unknown) => {
                // findFirst returns a single item or undefined
                const result = mockFunctions.selectMockFn();
                return result.then((items: unknown[]) =>
                    items.length > 0 ? items[0] : undefined
                );
            }),
        },
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration
    __setSelectResponse: (fn: any) => {
        mockFunctions.selectMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration
    __setInsertResponse: (fn: any) => {
        mockFunctions.insertMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration
    __setUpdateResponse: (fn: any) => {
        mockFunctions.updateMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration
    __setDeleteResponse: (fn: any) => {
        mockFunctions.deleteMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration
    __setFindManyResponse: (fn: any) => {
        mockFunctions.findManyMockFn = fn;
    },
    __getDeleteExecuteMock: () => deleteExecuteMock,
    __getTransactionMock: () => transactionMock,
    __getUpdateMock: () => updateMock,
    __reset: () => {
        mockFunctions.selectMockFn = () => Promise.resolve([]);
        mockFunctions.insertMockFn = () => Promise.resolve([]);
        mockFunctions.updateMockFn = () => Promise.resolve([]);
        mockFunctions.deleteMockFn = () => Promise.resolve([]);
        mockFunctions.findManyMockFn = () => Promise.resolve([]);
        deleteExecuteMock.mockClear();
        transactionMock.mockClear();
        updateMock.mockClear();
    },
};

class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export const sessionContextMock = new Elysia({ name: "Macro.session" })
    .guard({
        headers: t.Object({
            "x-wallet-auth": t.Optional(t.String()),
            "x-wallet-sdk-auth": t.Optional(t.String()),
        }),
    })
    .error({ UNAUTHORIZED: UnauthorizedError })
    .onError({ as: "global" }, ({ code, set }) => {
        if (code === "UNAUTHORIZED") {
            set.status = 401;
            return "Unauthorized";
        }
    })
    .macro({
        withWalletAuthent: {
            async resolve({ headers }) {
                const walletAuth = headers["x-wallet-auth"];
                if (!walletAuth) {
                    throw new UnauthorizedError();
                }
                // biome-ignore lint/suspicious/noExplicitAny: Mock function accepts arguments at runtime
                const auth = await (JwtContextMock.wallet.verify as any)(
                    walletAuth
                );
                if (!auth) {
                    throw new UnauthorizedError();
                }
                // Return the auth
                return { walletSession: auth };
            },
        },
        withWalletSdkAuthent: {
            async resolve({ headers }) {
                const walletSdkAuth = headers["x-wallet-sdk-auth"];
                if (!walletSdkAuth) {
                    throw new UnauthorizedError();
                }
                // biome-ignore lint/suspicious/noExplicitAny: Mock function accepts arguments at runtime
                const auth = await (JwtContextMock.walletSdk.verify as any)(
                    walletSdkAuth
                );
                if (!auth) {
                    throw new UnauthorizedError();
                }
                // Return the auth
                return { walletSdkSession: auth };
            },
        },
    });

/* -------------------------------------------------------------------------- */
/*                      Business Session Middleware Mock                      */
/* -------------------------------------------------------------------------- */

export const businessSessionContextMock = new Elysia({
    name: "Context.businessSession",
})
    .guard({
        headers: t.Object({
            "x-business-auth": t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers }) => {
        const businessAuth = headers["x-business-auth"];
        if (!businessAuth) {
            return { businessSession: null };
        }

        // biome-ignore lint/suspicious/noExplicitAny: Mock function accepts arguments at runtime
        const session = await (JwtContextMock.business.verify as any)(
            businessAuth
        );
        return {
            businessSession: session || null,
        };
    })
    .macro({
        businessAuthenticated(_skip?: boolean) {
            return {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs flexible typing
                beforeHandle: async ({ headers, set }: any) => {
                    const businessAuth = headers["x-business-auth"];
                    const session =
                        await // biome-ignore lint/suspicious/noExplicitAny: Mock function accepts arguments at runtime
                        (JwtContextMock.business.verify as any)(businessAuth);

                    if (!session) {
                        set.status = 401;
                        return "Unauthorized - Invalid business token";
                    }
                },
            };
        },
    })
    .as("scoped");

vi.mock("@backend-infrastructure", () => ({
    indexerApi: indexerApiMocks,
    pricingRepository: pricingRepositoryMocks,
    viemClient: viemMocks,
    adminWalletsRepository: adminWalletsRepositoryMocks,
    rolesRepository: rolesRepositoryMocks,
    sessionContext: sessionContextMock,
    get JwtContext() {
        return JwtContextMock;
    },
    get db() {
        return dbMock;
    },
    log: {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
    eventEmitter: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    },
}));

/* -------------------------------------------------------------------------- */
/*                      Business Session Middleware Mock                      */
/* -------------------------------------------------------------------------- */

export const webPushMocks = {
    sendNotification: vi.fn(() => Promise.resolve()),
    setVapidDetails: vi.fn(),
};
vi.mock("web-push", () => webPushMocks);

/* -------------------------------------------------------------------------- */
/*                            Notification Context                            */
/* -------------------------------------------------------------------------- */

export const notificationServiceMocks = {
    cleanupExpiredTokens: vi.fn(() => Promise.resolve()),
    sendNotification: vi.fn(() => Promise.resolve()),
};

const notificationMacroMock = new Elysia({ name: "Macro.notification" }).macro({
    cleanupTokens(_isEnabled?: boolean) {
        return {};
    },
});

const AddressPattern = /^0x[a-fA-F0-9]{40}$/;

const SendNotificationTargetsDto = t.Union([
    t.Object({
        wallets: t.Array(
            t.String({
                pattern: AddressPattern.source,
                minLength: 42,
                maxLength: 42,
            })
        ),
    }),
    t.Object({
        filter: t.Partial(
            t.Object({
                productIds: t.Array(t.String()),
                interactions: t.Partial(
                    t.Object({
                        min: t.Number(),
                        max: t.Number(),
                    })
                ),
                rewards: t.Partial(
                    t.Object({
                        min: t.String(),
                        max: t.String(),
                    })
                ),
                firstInteractionTimestamp: t.Partial(
                    t.Object({
                        min: t.Number(),
                        max: t.Number(),
                    })
                ),
            })
        ),
    }),
]);

const SendNotificationPayloadDto = t.Object({
    title: t.String(),
    body: t.String(),
    badge: t.Optional(t.String()),
    icon: t.Optional(t.String()),
    lang: t.Optional(t.String()),
    requireInteraction: t.Optional(t.Boolean()),
    silent: t.Optional(t.Boolean()),
    tag: t.Optional(t.String()),
    data: t.Optional(
        t.Object({
            url: t.Optional(t.String()),
        })
    ),
    actions: t.Optional(
        t.Array(
            t.Object({
                action: t.String(),
                title: t.String(),
                icon: t.Optional(t.String()),
            })
        )
    ),
});

vi.mock("../../src/domain/notifications", () => ({
    NotificationContext: {
        services: { notifications: notificationServiceMocks },
    },
    notificationMacro: notificationMacroMock,
    pushTokensTable: {},
    SendNotificationPayloadDto,
    SendNotificationTargetsDto,
}));

/* -------------------------------------------------------------------------- */
/*                            Interactions Context                            */
/* -------------------------------------------------------------------------- */

export const campaignRewardsServiceMocks = {
    getActiveRewardsForProduct: vi.fn(() => Promise.resolve(undefined)),
};

const InteractionRequestDto = t.Object({
    wallet: t.String(),
    productId: t.String(),
    interaction: t.Object({
        handlerTypeDenominator: t.String(),
        interactionData: t.String(),
    }),
    signature: t.Optional(t.Union([t.String(), t.Undefined(), t.Null()])),
});

vi.mock("../../src/domain/interactions", () => ({
    InteractionsContext: {
        services: { campaignRewards: campaignRewardsServiceMocks },
    },
    pendingInteractionsTable: {},
    interactionsPurchaseTrackerTable: {},
    backendTrackerTable: {},
    InteractionRequestDto,
}));

/* -------------------------------------------------------------------------- */
/*                            Business Domain Mocks                           */
/* -------------------------------------------------------------------------- */

export const dnsCheckRepositoryMocks = {
    getNormalizedDomain: vi.fn((domain: string) => domain),
    getDnsTxtString: vi.fn(
        (_args: { domain: string; owner: Address }) =>
            `frak-business; hash=0x123`
    ),
    isValidDomain: vi.fn(() => Promise.resolve(false)),
};

export const mintRepositoryMocks = {
    precomputeProductId: vi.fn((_domain: string) => BigInt(0)),
    isExistingProduct: vi.fn((_productId: bigint) => Promise.resolve(false)),
    mintProduct: vi.fn(() =>
        Promise.resolve({
            mintTxHash: "0x123" as `0x${string}`,
            productId: BigInt(1),
            interactionResult: undefined,
            bankResult: undefined,
        })
    ),
};

vi.mock("../../src/domain/business/context", () => ({
    BusinessContext: {
        repositories: {
            dnsCheck: dnsCheckRepositoryMocks,
            mint: mintRepositoryMocks,
        },
    },
}));

/* -------------------------------------------------------------------------- */
/*                     Helper Functions for Business Session                  */
/* -------------------------------------------------------------------------- */

export function setMockBusinessSession(
    session: { wallet: `0x${string}` } | null
): void {
    if (session === null) {
        JwtContextMock.business.verify.mockResolvedValue(null as never);
    } else {
        JwtContextMock.business.verify.mockResolvedValue(session as never);
    }
}

export function resetMockBusinessSession(): void {
    JwtContextMock.business.verify.mockReset();
    JwtContextMock.business.verify.mockResolvedValue(null as never);
}
