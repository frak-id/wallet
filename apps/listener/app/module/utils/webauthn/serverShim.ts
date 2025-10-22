/**
 * Shim for @simplewebauthn/server package
 * Provides browser-compatible implementations for listener app
 * This file replaces the Node.js-only @simplewebauthn/server package
 */

import { generateAuthenticationOptions } from "./authenticationOptions";

// Re-export browser-compatible implementations
export { generateAuthenticationOptions };

// Mock other server functions that might be imported but not used
export const generateRegistrationOptions = () => {
    throw new Error(
        "generateRegistrationOptions should not be called in listener app. Use wallet app instead."
    );
};

export const verifyAuthenticationResponse = () => {
    throw new Error(
        "verifyAuthenticationResponse should not be called in browser. Use backend API instead."
    );
};

export const verifyRegistrationResponse = () => {
    throw new Error(
        "verifyRegistrationResponse should not be called in browser. Use backend API instead."
    );
};
