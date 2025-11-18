import { vi } from "vitest";
import type { Address, LocalAccount } from "viem";
import { viemMocks } from "./viem";

/* -------------------------------------------------------------------------- */
/*                               Backend commons                              */
/* -------------------------------------------------------------------------- */

export const indexerApiMocks = {
    get: vi.fn(() => ({
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

// biome-ignore lint/suspicious/noExplicitAny: Mock object requires flexible typing for Drizzle ORM compatibility
export const dbMock: any = {
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn((_condition?: unknown) => {
                const chainable = {
                    limit: vi.fn((_count?: number) =>
                        mockFunctions.selectMockFn()
                    ),
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
            onConflictDoNothing: vi.fn(() => mockFunctions.insertMockFn()),
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
            // biome-ignore lint/suspicious/noExplicitAny: Drizzle query options require flexible typing
            findMany: vi.fn((_opts?: any) => mockFunctions.findManyMockFn()),
        },
        pushTokensTable: {
            // biome-ignore lint/suspicious/noExplicitAny: Drizzle query options require flexible typing
            findMany: vi.fn((_opts?: any) => mockFunctions.findManyMockFn()),
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

vi.mock("@backend-infrastructure", () => ({
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

/* -------------------------------------------------------------------------- */
/*                                   Webpush                                  */
/* -------------------------------------------------------------------------- */

export const webPushMocks = {
    sendNotification: vi.fn(() => Promise.resolve()),
    setVapidDetails: vi.fn(() => {}),
};
vi.mock("web-push", () => webPushMocks);
