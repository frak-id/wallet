import { Elysia, t } from "elysia";
import type { Address, LocalAccount } from "viem";
import { vi } from "vitest";
import { viemMocks } from "./viem";

/* -------------------------------------------------------------------------- */
/*                               Backend commons                              */
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

export const interactionDiamondRepositoryMocks = {
    getDiamondContract: vi.fn(<T = Address | undefined>() =>
        Promise.resolve(undefined as T)
    ),
    getInteractionDiamond: vi.fn(<T = Address | undefined>() =>
        Promise.resolve(undefined as T)
    ),
};

export const rolesRepositoryMocks = {
    getRoles: vi.fn(() => Promise.resolve([])),
};

export const onChainRolesRepositoryMocks = {
    getRolesOnProduct: vi.fn(() =>
        Promise.resolve({ isOwner: false, roles: 0n })
    ),
    hasRoleOrAdminOnProduct: vi.fn(() => Promise.resolve(false)),
    hasRoles: vi.fn(
        ({ onChainRoles, role }: { onChainRoles: bigint; role: bigint }) =>
            (onChainRoles & role) !== 0n
    ),
    hasRolesOrAdmin: vi.fn(
        ({ onChainRoles, role }: { onChainRoles: bigint; role: bigint }) => {
            const productAdministrator = BigInt(1 << 0);
            return (onChainRoles & (role | productAdministrator)) !== 0n;
        }
    ),
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
};

/**
 * Flexible database mock for Drizzle ORM that can be customized per test.
 *
 * Uses an object to hold mock functions so they can be reassigned and all references update.
 * This allows tests to configure different responses for different scenarios.
 *
 * @example Basic usage in tests
 * ```typescript
 * beforeEach(() => {
 *     dbMock.__reset();  // Clear previous test configurations
 *     dbMock.__setSelectResponse(() => Promise.resolve([mockData]));
 * });
 *
 * it("should fetch data", async () => {
 *     const result = await db.select().from(table).where(condition);
 *     expect(result).toEqual([mockData]);
 * });
 * ```
 *
 * @example Multiple query types
 * ```typescript
 * dbMock.__setSelectResponse(() => Promise.resolve([{ id: 1 }]));
 * dbMock.__setInsertResponse(() => Promise.resolve([{ id: 2 }]));
 * dbMock.__setFindManyResponse(() => Promise.resolve([{ id: 3 }]));
 * ```
 */
const mockFunctions = {
    selectMockFn: () => Promise.resolve([]),
    insertMockFn: () => Promise.resolve([]),
    updateMockFn: () => Promise.resolve([]),
    deleteMockFn: () => Promise.resolve([]),
    findManyMockFn: () => Promise.resolve([]),
};

// Create separate mocks so tests can verify they were called
const deleteExecuteMock = vi.fn(() => mockFunctions.deleteMockFn());
// biome-ignore lint/suspicious/noExplicitAny: Transaction callback needs flexible typing
const transactionMock = vi.fn(async (fn: any) => {
    const result = await fn(dbMock);
    return result;
});
// biome-ignore lint/suspicious/noExplicitAny: Update accepts table argument
const updateMock = vi.fn((_table?: any) => ({
    set: vi.fn(() => ({
        where: vi.fn(() => ({
            returning: vi.fn(() => mockFunctions.updateMockFn()),
            // biome-ignore lint/suspicious/noThenProperty: mocked stuff
            then: (onfulfilled?: (value: unknown) => unknown) => {
                const promise = mockFunctions.updateMockFn();
                return promise.then(onfulfilled);
            },
        })),
    })),
}));

// Helper to create a thenable object that can be awaited or chained
const createThenable = (
    promiseFn: () => Promise<unknown>,
    chainMethods: Record<string, unknown> = {}
) => {
    // Create a lazy thenable that calls promiseFn when awaited
    const thenable = {
        // biome-ignore lint/suspicious/noThenProperty: Required for promise-like behavior in mocks
        then: (
            onfulfilled?: (value: unknown) => unknown,
            onrejected?: (reason: unknown) => unknown
        ) => {
            const promise = promiseFn();
            return promise.then(onfulfilled, onrejected);
        },
        catch: (onrejected?: (reason: unknown) => unknown) => {
            const promise = promiseFn();
            return promise.catch(onrejected);
        },
        finally: (onfinally?: () => void) => {
            const promise = promiseFn();
            return promise.finally(onfinally);
        },
        ...chainMethods,
    };
    return thenable;
};

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
    // Helper methods to configure mock responses
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration requires flexible function types
    __setSelectResponse: (fn: any) => {
        mockFunctions.selectMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration requires flexible function types
    __setInsertResponse: (fn: any) => {
        mockFunctions.insertMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration requires flexible function types
    __setUpdateResponse: (fn: any) => {
        mockFunctions.updateMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration requires flexible function types
    __setDeleteResponse: (fn: any) => {
        mockFunctions.deleteMockFn = fn;
    },
    // biome-ignore lint/suspicious/noExplicitAny: Mock configuration requires flexible function types
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

// Mock for sessionContext Elysia plugin
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
/*                          Iron Session Mock                                 */
/*  -------------------------------------------------------------------------- */

export const ironSessionMocks = {
    unsealData: vi.fn(<T>() => Promise.resolve(undefined as T | undefined)),
};

// Mock iron-session module with proper named export
// The real middleware imports: import { unsealData } from "iron-session";
vi.mock("iron-session", () => ({
    unsealData: ironSessionMocks.unsealData,
}));

/* -------------------------------------------------------------------------- */
/*                      Business Session Middleware Mock                      */
/* -------------------------------------------------------------------------- */

// Mock for businessSessionContext Elysia plugin
// Uses manual Cookie header parsing since Elysia's cookie parser doesn't work in tests
// IMPORTANT: .as("scoped") is required for .resolve() to execute when composed via .use()
export const businessSessionContextMock = new Elysia({
    name: "Context.businessSession",
})
    .resolve(async ({ request }) => {
        // Manually parse Cookie header to get the businessSession value
        const cookieHeader = request.headers.get("Cookie");
        let cookieValue = "mock-token"; // Default token for tests

        if (cookieHeader) {
            const match = cookieHeader.match(/businessSession=([^;]+)/);
            if (match) {
                cookieValue = match[1];
            }
        }

        // Always call the mocked unsealData function (even without a cookie)
        // This allows setMockBusinessSession() to work without requiring cookies
        // biome-ignore lint/suspicious/noExplicitAny: Mock function needs flexible typing
        const session = await (ironSessionMocks.unsealData as any)(
            cookieValue,
            { password: "test", ttl: 60 }
        );

        return { businessSession: session };
    })
    .macro({
        nextAuthenticated: {
            // biome-ignore lint/suspicious/noExplicitAny: Mock function needs flexible typing
            beforeHandle: async ({ request, set }: any) => {
                const cookieHeader = request.headers.get("Cookie");
                let cookieValue: string | undefined;

                if (cookieHeader) {
                    const match = cookieHeader.match(/businessSession=([^;]+)/);
                    if (match) {
                        cookieValue = match[1];
                    }
                }

                if (!cookieValue) {
                    set.status = 401;
                    return "Missing business auth cookie";
                }

                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs flexible typing
                const session = await (ironSessionMocks.unsealData as any)(
                    cookieValue,
                    { password: "test", ttl: 60 }
                );

                if (!session) {
                    set.status = 401;
                    return "Missing business auth cookie";
                }
            },
        },
    })
    .as("scoped");

vi.mock("@backend-infrastructure", () => ({
    indexerApi: indexerApiMocks,
    pricingRepository: pricingRepositoryMocks,
    viemClient: viemMocks,
    adminWalletsRepository: adminWalletsRepositoryMocks,
    interactionDiamondRepository: interactionDiamondRepositoryMocks,
    rolesRepository: rolesRepositoryMocks,
    onChainRolesRepository: onChainRolesRepositoryMocks,
    sessionContext: sessionContextMock,
    get JwtContext() {
        return JwtContextMock;
    },
    get db() {
        return dbMock;
    },
    log: {
        debug: vi.fn(() => {}),
        info: vi.fn(() => {}),
        error: vi.fn(() => {}),
        warn: vi.fn(() => {}),
    },
    eventEmitter: {
        emit: vi.fn(() => {}),
        on: vi.fn(() => {}),
        off: vi.fn(() => {}),
    },
}));

// Mock the business session middleware module
// NOTE: This vi.mock() has been moved to individual test files
// because Vitest doesn't hoist mocks across module boundaries.
// Each test file must define its own vi.mock() for the middleware.
// vi.mock("../../src/api/business/middleware/session", () => ({
//     businessSessionContext: businessSessionContextMock,
// }));

/* -------------------------------------------------------------------------- */
/*                                   Webpush                                  */
/* -------------------------------------------------------------------------- */

export const webPushMocks = {
    sendNotification: vi.fn(() => Promise.resolve()),
    setVapidDetails: vi.fn(() => {}),
};
vi.mock("web-push", () => webPushMocks);

/* -------------------------------------------------------------------------- */
/*                            Notification Context                            */
/* -------------------------------------------------------------------------- */

export const notificationServiceMocks = {
    cleanupExpiredTokens: vi.fn(() => Promise.resolve()),
    sendNotification: vi.fn(() => Promise.resolve()),
};

// Mock notification macro
const notificationMacroMock = new Elysia({ name: "Macro.notification" }).macro({
    cleanupTokens(_isEnabled?: boolean) {
        return {};
    },
});

// Create proper TypeBox schemas for SendNotificationDto
// Address pattern for validation
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

// Mock the notification domain
vi.mock("../../src/domain/notifications", () => ({
    NotificationContext: {
        services: {
            notifications: notificationServiceMocks,
        },
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

// Create a proper mock for InteractionRequestDto that matches the real schema
// Using Elysia's t (TypeBox wrapper) which is already imported
const InteractionRequestDto = t.Object({
    wallet: t.String(),
    productId: t.String(),
    interaction: t.Object({
        handlerTypeDenominator: t.String(),
        interactionData: t.String(),
    }),
    signature: t.Optional(t.Union([t.String(), t.Undefined(), t.Null()])),
});

// Mock the interactions domain
vi.mock("../../src/domain/interactions", () => ({
    InteractionsContext: {
        services: {
            campaignRewards: campaignRewardsServiceMocks,
        },
    },
    pendingInteractionsTable: {},
    interactionsPurchaseTrackerTable: {},
    backendTrackerTable: {},
    InteractionRequestDto,
}));

/* -------------------------------------------------------------------------- */
/*                     Helper Functions for Business Session                  */
/* -------------------------------------------------------------------------- */

/**
 * Set the mock business session value
 */
export function setMockBusinessSession(
    session: { wallet: `0x${string}` } | null
): void {
    if (session === null) {
        ironSessionMocks.unsealData.mockResolvedValue(undefined);
    } else {
        ironSessionMocks.unsealData.mockResolvedValue(session);
    }
}

/**
 * Reset the mock business session to return undefined
 * This clears any previous mockResolvedValue/mockResolvedValueOnce calls
 */
export function resetMockBusinessSession(): void {
    // Use mockReset() to clear all mocks and set default return value to undefined
    ironSessionMocks.unsealData.mockReset();
    ironSessionMocks.unsealData.mockResolvedValue(undefined);
}
