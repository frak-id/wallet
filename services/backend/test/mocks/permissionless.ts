import { mock } from "bun:test";

/**
 * Permissionless module mocks
 */
export const permissionlessMocks = {
    getSenderAddress: mock(() => Promise.resolve("0x1234567890abcdef1234567890abcdef12345678")),
};

/**
 * Reset all permissionless mocks to their default implementations
 */
export function resetPermissionlessMocks() {
    permissionlessMocks.getSenderAddress.mockImplementation(() => 
        Promise.resolve("0x1234567890abcdef1234567890abcdef12345678")
    );
}

/**
 * Clear all permissionless mock call history
 */
export function clearPermissionlessMocks() {
    permissionlessMocks.getSenderAddress.mockClear();
}

/**
 * Setup permissionless module mocks
 */
export function setupPermissionlessMocks() {
    mock.module("permissionless/actions", () => ({
        getSenderAddress: permissionlessMocks.getSenderAddress,
    }));
}