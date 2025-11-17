import { mock } from "bun:test";
import type { Address, LocalAccount } from "viem";
import { viemMocks } from "./viem";

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
    getProductSpecificAccount: mock(() =>
        Promise.resolve(undefined as undefined | LocalAccount)
    ),
    getMutexForAccount: mock(() => ({
        runExclusive: mock((fn: () => Promise<unknown>) => fn()),
    })),
};

export const interactionDiamondRepositoryMocks = {
    getDiamondContract: mock(<T = Address | undefined>() =>
        Promise.resolve(undefined as T)
    ),
    getInteractionDiamond: mock(<T = Address | undefined>() =>
        Promise.resolve(undefined as T)
    ),
};

export const rolesRepositoryMocks = {
    getRoles: mock(() => Promise.resolve([])),
};

export const JwtContextMock = {
    wallet: {
        sign: mock(() => Promise.resolve("mock-jwt-token")),
        verify: mock(() => Promise.resolve({ wallet: "0x123" })),
    },
    walletSdk: {
        sign: mock(() => Promise.resolve("mock-sdk-jwt-token")),
        verify: mock(() => Promise.resolve({ wallet: "0x123" })),
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
const deleteExecuteMock = mock(() => mockFunctions.deleteMockFn());
// biome-ignore lint/suspicious/noExplicitAny: Transaction callback needs flexible typing
const transactionMock = mock(async (fn: any) => {
    const result = await fn(dbMock);
    return result;
});
// biome-ignore lint/suspicious/noExplicitAny: Update accepts table argument
const updateMock = mock((_table?: any) => ({
    set: mock(() => ({
        where: mock(() => ({
            returning: mock(() => mockFunctions.updateMockFn()),
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

// biome-ignore lint/suspicious/noExplicitAny: Mock object requires flexible typing for Drizzle ORM compatibility
export const dbMock: any = {
    select: mock(() => ({
        from: mock(() => ({
            where: mock((_condition?: unknown) => {
                const chainable = {
                    limit: mock((_count?: number) =>
                        mockFunctions.selectMockFn()
                    ),
                    innerJoin: mock(() => ({
                        where: mock(() => ({
                            limit: mock(() => mockFunctions.selectMockFn()),
                        })),
                    })),
                };
                return createThenable(
                    () => mockFunctions.selectMockFn(),
                    chainable
                );
            }),
            innerJoin: mock(() => ({
                where: mock(() => ({
                    limit: mock(() => mockFunctions.selectMockFn()),
                })),
            })),
            limit: mock(() => mockFunctions.selectMockFn()),
        })),
    })),
    insert: mock(() => ({
        values: mock(() => ({
            returning: mock(() => mockFunctions.insertMockFn()),
            onConflictDoUpdate: mock(() => ({
                returning: mock(() => mockFunctions.insertMockFn()),
            })),
            onConflictDoNothing: mock(() => mockFunctions.insertMockFn()),
        })),
    })),
    update: updateMock,
    delete: mock(() => ({
        where: mock(() => {
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
            // biome-ignore lint/suspicious/noExplicitAny: Drizzle query options require flexible typing
            findMany: mock((_opts?: any) => mockFunctions.findManyMockFn()),
        },
        pushTokensTable: {
            // biome-ignore lint/suspicious/noExplicitAny: Drizzle query options require flexible typing
            findMany: mock((_opts?: any) => mockFunctions.findManyMockFn()),
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

mock.module("@backend-infrastructure", () => ({
    indexerApi: indexerApiMocks,
    pricingRepository: pricingRepositoryMocks,
    viemClient: viemMocks,
    adminWalletsRepository: adminWalletsRepositoryMocks,
    interactionDiamondRepository: interactionDiamondRepositoryMocks,
    rolesRepository: rolesRepositoryMocks,
    get JwtContext() {
        return JwtContextMock;
    },
    get db() {
        return dbMock;
    },
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
