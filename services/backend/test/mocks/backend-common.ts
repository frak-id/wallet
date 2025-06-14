import { mock } from "bun:test";

/**
 * Backend common module mocks
 */
export const backendCommonMocks = {
    indexerApi: {
        get: mock(() => ({
            json: mock(() => Promise.resolve({
                campaigns: [] as any[],
                tokens: [] as any[],
            })),
        })),
    },
    pricingRepository: {
        getTokenPrice: mock(() => Promise.resolve({
            eur: 1.0,
            usd: 1.1,
            gbp: 0.9,
        }) as any),
    },
    viemClient: {
        request: mock(() => Promise.resolve("0x1234567890abcdef")),
    },
};

/**
 * Reset all backend-common mocks to their default implementations
 */
export function resetBackendCommonMocks() {
    backendCommonMocks.indexerApi.get.mockImplementation(() => ({
        json: mock(() => Promise.resolve({
            campaigns: [] as any[],
            tokens: [] as any[],
        })),
    }));
    
    backendCommonMocks.pricingRepository.getTokenPrice.mockImplementation(() => Promise.resolve({
        eur: 1.0,
        usd: 1.1,
        gbp: 0.9,
    }) as any);
    
    backendCommonMocks.viemClient.request.mockImplementation(() => Promise.resolve("0x1234567890abcdef"));
}

/**
 * Clear all backend-common mock call history
 */
export function clearBackendCommonMocks() {
    backendCommonMocks.indexerApi.get.mockClear();
    backendCommonMocks.pricingRepository.getTokenPrice.mockClear();
    backendCommonMocks.viemClient.request.mockClear();
}

/**
 * Setup backend-common module mocks
 */
export function setupBackendCommonMocks() {
    mock.module("@backend-common", () => ({
        indexerApi: backendCommonMocks.indexerApi,
        pricingRepository: backendCommonMocks.pricingRepository,
        viemClient: backendCommonMocks.viemClient,
    }));
}