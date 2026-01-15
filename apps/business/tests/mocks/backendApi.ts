/**
 * Centralized mock factory for authenticatedBackendApi
 * Reduces duplication across business app tests
 */
import { vi } from "vitest";

/**
 * Mock for merchant webhook endpoints (new merchant-based API)
 * Used by: useWebhookInteractionStatus, useWebhookInteractionSetup, useWebhookInteractionDelete
 */
export function mockMerchantWebhooks(options?: {
    get?: ReturnType<typeof vi.fn>;
    post?: ReturnType<typeof vi.fn>;
    delete?: ReturnType<typeof vi.fn>;
}) {
    return {
        webhooks: {
            get: options?.get ?? vi.fn(),
            post: options?.post ?? vi.fn(),
            delete: options?.delete ?? vi.fn(),
        },
        // biome-ignore lint/suspicious/noExplicitAny: Mock needs any for partial type compatibility
    } as any;
}

/**
 * @deprecated Use mockMerchantWebhooks instead - kept for backward compatibility during migration
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
    // Translate old options format to new merchant webhook format
    return mockMerchantWebhooks({
        get: options?.status?.get,
        post: options?.setup?.post,
        delete: options?.delete?.post,
    });
}

/**
 * @deprecated Use mockMerchantWebhooks instead - kept for backward compatibility during migration
 * Mock for product oracle endpoints
 * Used by: useOracleSetupData
 */
export function mockProductOracle(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    return mockMerchantWebhooks({
        get: options?.status?.get,
    });
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
 * Create a base mock for authenticatedBackendApi.merchant function
 * Returns a function that can be mocked to return different endpoint structures
 */
export function createMerchantMock() {
    return vi.fn();
}

/**
 * @deprecated Use createMerchantMock instead
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
        merchant: createMerchantMock(),
        product: createProductMock(),
        roles: createRolesMock(),
        funding: createFundingMock(),
    };
}

/**
 * Helper to create a merchant mock that returns webhook endpoints
 * Reduces boilerplate in webhook-related tests
 */
export function setupMerchantWebhookMock(options?: {
    get?: ReturnType<typeof vi.fn>;
    post?: ReturnType<typeof vi.fn>;
    delete?: ReturnType<typeof vi.fn>;
}) {
    const merchantMock = createMerchantMock();
    merchantMock.mockReturnValue(mockMerchantWebhooks(options));
    return merchantMock;
}

/**
 * @deprecated Use setupMerchantWebhookMock instead
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
    const merchantMock = createMerchantMock();
    merchantMock.mockReturnValue(
        mockMerchantWebhooks({
            get: options?.status?.get,
            post: options?.setup?.post,
            delete: options?.delete?.post,
        })
    );
    return merchantMock;
}

/**
 * @deprecated Use setupMerchantWebhookMock instead
 * Helper to create a product mock that returns oracle endpoints
 */
export function setupOracleProductMock(options?: {
    status?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    const merchantMock = createMerchantMock();
    merchantMock.mockReturnValue(
        mockMerchantWebhooks({
            get: options?.status?.get,
        })
    );
    return merchantMock;
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
