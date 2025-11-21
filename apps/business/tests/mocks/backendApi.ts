/**
 * Centralized mock factory for authenticatedBackendApi
 * Reduces duplication across business app tests
 */
import { vi } from "vitest";

/**
 * Mock for product webhook endpoints
 * Used by: useWebhookInteractionStatus, useWebhookInteractionSetup, useWebhookInteractionDelete
 */
export function mockProductWebhook(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
    setup?: {
        post?: ReturnType<typeof vi.fn>;
    };
    delete?: {
        post?: ReturnType<typeof vi.fn>;
    };
}) {
    return {
        interactionsWebhook: {
            status: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: options?.status?.get ?? (vi.fn() as any),
            },
            setup: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: options?.setup?.post ?? (vi.fn() as any),
            },
            delete: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: options?.delete?.post ?? (vi.fn() as any),
            },
        },
        oracleWebhook: {
            status: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: vi.fn() as any,
            },
            setup: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
            delete: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
        },
    };
}

/**
 * Mock for product oracle endpoints
 * Used by: useOracleSetupData
 */
export function mockProductOracle(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    return {
        interactionsWebhook: {
            status: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: vi.fn() as any,
            },
            setup: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
            delete: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
        },
        oracleWebhook: {
            status: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: options?.status?.get ?? (vi.fn() as any),
            },
            setup: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
            delete: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                post: vi.fn() as any,
            },
        },
    };
}

/**
 * Mock for product mint endpoints (DNS)
 * Used by: dnsRecordHooks
 */
export function mockProductMint(options?: {
    dnsTxt?: {
        get?: ReturnType<typeof vi.fn>;
    };
    verify?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    return {
        mint: {
            dnsTxt: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: options?.dnsTxt?.get ?? (vi.fn() as any),
            },
            verify: {
                // biome-ignore lint/suspicious/noExplicitAny: Mock function needs any for type compatibility
                get: options?.verify?.get ?? (vi.fn() as any),
            },
        },
    };
}

/**
 * Create a base mock for authenticatedBackendApi.product function
 * Returns a function that can be mocked to return different endpoint structures
 */
export function createProductMock() {
    return vi.fn();
}

/**
 * Mock for roles endpoint
 * Used by: useHasRoleOnProduct
 */
export function createRolesMock() {
    return {
        get: vi.fn(),
    };
}

/**
 * Mock for funding endpoints
 * Used by: useFundTestBank
 */
export function createFundingMock() {
    return {
        getTestToken: {
            post: vi.fn(),
        },
    };
}

/**
 * Create complete authenticatedBackendApi mock
 * Use this as base mock in vi.mock(), then customize per test
 */
export function createBackendApiMock() {
    return {
        product: createProductMock(),
        roles: createRolesMock(),
        funding: createFundingMock(),
    };
}

/**
 * Helper to create a product mock that returns webhook endpoints
 * Reduces boilerplate in webhook-related tests
 */
export function setupWebhookProductMock(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
    setup?: {
        post?: ReturnType<typeof vi.fn>;
    };
    delete?: {
        post?: ReturnType<typeof vi.fn>;
    };
}) {
    const productMock = createProductMock();
    productMock.mockReturnValue(mockProductWebhook(options));
    return productMock;
}

/**
 * Helper to create a product mock that returns oracle endpoints
 */
export function setupOracleProductMock(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    const productMock = createProductMock();
    productMock.mockReturnValue(mockProductOracle(options));
    return productMock;
}

/**
 * Helper to create a product mock that returns mint endpoints
 */
export function setupMintProductMock(options?: {
    dnsTxt?: {
        get?: ReturnType<typeof vi.fn>;
    };
    verify?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    const productMock = createProductMock();
    productMock.mockReturnValue(mockProductMint(options));
    return productMock;
}
