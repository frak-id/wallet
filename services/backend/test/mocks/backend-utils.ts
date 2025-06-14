import { mock } from "bun:test";

/**
 * Backend utils module mocks
 */
export const backendUtilsMocks = {
    referralCampaign_isActive: {
        name: "isActive",
        type: "function",
    },
};

/**
 * Reset all backend-utils mocks to their default implementations
 */
export function resetBackendUtilsMocks() {
    // No dynamic mocks to reset for backend-utils currently
}

/**
 * Clear all backend-utils mock call history
 */
export function clearBackendUtilsMocks() {
    // No dynamic mocks to clear for backend-utils currently
}

/**
 * Setup backend-utils module mocks
 */
export function setupBackendUtilsMocks() {
    mock.module("@backend-utils", () => ({
        referralCampaign_isActive: backendUtilsMocks.referralCampaign_isActive,
    }));
}