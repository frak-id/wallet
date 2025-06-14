/**
 * Central mock registry for all test files
 * 
 * This file provides a centralized way to manage all mocks across the test suite.
 * It prevents mock leakage between tests by providing proper setup, reset, and cleanup functions.
 * 
 * Usage in test files:
 * ```typescript
 * import { setupAllMocks, resetAllMocks, clearAllMocks } from "../test/mocks";
 * 
 * describe("YourService", () => {
 *     beforeAll(() => {
 *         setupAllMocks();
 *     });
 * 
 *     beforeEach(() => {
 *         resetAllMocks();
 *     });
 * 
 *     afterAll(() => {
 *         clearAllMocks();
 *     });
 * });
 * ```
 */

// Import all mock modules
import { 
    setupViemMocks, 
    resetViemMocks, 
    clearViemMocks, 
    viemMocks 
} from "./mocks/viem";

import { 
    setupBackendCommonMocks, 
    resetBackendCommonMocks, 
    clearBackendCommonMocks, 
    backendCommonMocks 
} from "./mocks/backend-common";

import { 
    setupBackendUtilsMocks, 
    resetBackendUtilsMocks, 
    clearBackendUtilsMocks, 
    backendUtilsMocks 
} from "./mocks/backend-utils";

import { 
    setupPermissionlessMocks, 
    resetPermissionlessMocks, 
    clearPermissionlessMocks, 
    permissionlessMocks 
} from "./mocks/permissionless";

import { 
    setupSimplewebauthnMocks, 
    resetSimplewebauthnMocks, 
    clearSimplewebauthnMocks, 
    simplewebauthnMocks 
} from "./mocks/simplewebauthn";

/**
 * Export all individual mock objects for direct access in tests
 */
export const mocks = {
    viem: viemMocks,
    backendCommon: backendCommonMocks,
    backendUtils: backendUtilsMocks,
    permissionless: permissionlessMocks,
    simplewebauthn: simplewebauthnMocks,
};

/**
 * Setup all module mocks
 * Call this in beforeAll() hook
 */
export function setupAllMocks() {
    setupViemMocks();
    setupBackendCommonMocks();
    setupBackendUtilsMocks();
    setupPermissionlessMocks();
    setupSimplewebauthnMocks();
}

/**
 * Reset all mocks to their default implementations
 * Call this in beforeEach() hook to ensure clean state between tests
 */
export function resetAllMocks() {
    resetViemMocks();
    resetBackendCommonMocks();
    resetBackendUtilsMocks();
    resetPermissionlessMocks();
    resetSimplewebauthnMocks();
}

/**
 * Clear all mock call history
 * Call this in afterAll() hook or as needed
 */
export function clearAllMocks() {
    clearViemMocks();
    clearBackendCommonMocks();
    clearBackendUtilsMocks();
    clearPermissionlessMocks();
    clearSimplewebauthnMocks();
}

/**
 * Utility function to setup a clean test environment
 * This combines setup, reset, and provides cleanup
 */
export function createTestEnvironment() {
    setupAllMocks();
    resetAllMocks();
    
    return {
        mocks,
        reset: resetAllMocks,
        clear: clearAllMocks,
    };
}