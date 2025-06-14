import { mock } from "bun:test";

/**
 * SimpleWebAuthn module mocks
 */
export const simplewebauthnMocks = {
    verifyAuthenticationResponse: mock(() => Promise.resolve({
        verified: true,
        authenticationInfo: {
            newCounter: 5,
        },
    })),
};

/**
 * Reset all simplewebauthn mocks to their default implementations
 */
export function resetSimplewebauthnMocks() {
    simplewebauthnMocks.verifyAuthenticationResponse.mockImplementation(() => Promise.resolve({
        verified: true,
        authenticationInfo: {
            newCounter: 5,
        },
    }));
}

/**
 * Clear all simplewebauthn mock call history
 */
export function clearSimplewebauthnMocks() {
    simplewebauthnMocks.verifyAuthenticationResponse.mockClear();
}

/**
 * Setup simplewebauthn module mocks
 */
export function setupSimplewebauthnMocks() {
    mock.module("@simplewebauthn/server", () => ({
        verifyAuthenticationResponse: simplewebauthnMocks.verifyAuthenticationResponse,
    }));
}