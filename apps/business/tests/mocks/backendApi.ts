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
 * Mock for merchant mint endpoints (DNS)
 * Used by: dnsRecordHooks
 */
function mockMerchantMint(options?: {
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
 * Helper to create a merchant mock that returns mint endpoints
 */
export function setupMintMerchantMock(options?: {
    dnsTxt?: {
        get?: ReturnType<typeof vi.fn>;
    };
    verify?: {
        get?: ReturnType<typeof vi.fn>;
    };
}) {
    const merchantMock = createMerchantMock();
    merchantMock.mockReturnValue(mockMerchantMint(options));
    return merchantMock;
}
