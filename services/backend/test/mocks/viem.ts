import { mock } from "bun:test";
import type { Hex } from "viem";

/**
 * Viem module mocks with default implementations that mirror the actual functions
 */
export const viemMocks = {
    // Core viem functions
    keccak256: mock((data: string) => `0x${data.replace('0x', '').substring(0, 16)}` as Hex),
    concatHex: mock((values: string[]) => values.join("") as Hex),
    formatUnits: mock(() => "1.0"),
    
    // Viem actions
    multicall: mock(() => Promise.resolve([]) as any),
};

/**
 * Reset all viem mocks to their default implementations
 */
export function resetViemMocks() {
    viemMocks.keccak256.mockImplementation((data: string) => `0x${data.replace('0x', '').substring(0, 16)}` as Hex);
    viemMocks.concatHex.mockImplementation((values: string[]) => values.join("") as Hex);
    viemMocks.formatUnits.mockImplementation(() => "1.0");
    viemMocks.multicall.mockImplementation(() => Promise.resolve([]) as any);
}

/**
 * Clear all viem mock call history
 */
export function clearViemMocks() {
    for (const mockFn of Object.values(viemMocks)) {
        mockFn.mockClear();
    }
}

/**
 * Setup viem module mocks
 */
export function setupViemMocks() {
    mock.module("viem", () => ({
        keccak256: viemMocks.keccak256,
        concatHex: viemMocks.concatHex,
        formatUnits: viemMocks.formatUnits,
    }));

    mock.module("viem/actions", () => ({
        multicall: viemMocks.multicall,
    }));
}