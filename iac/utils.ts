import type { Stack } from "sst/constructs";

export const openNextVersion = "3.1.1";

/**
 * Check if we are running in prod or not
 * @param stack
 */
export function isProdStack(stack: Stack): boolean {
    return stack.stage === "prod";
}

/**
 * Check if we are running in dev or not
 * @param stack
 */
export function isDevStack(stack: Stack): boolean {
    return stack.stage === "dev";
}

/**
 * Check if we are running a distant stack
 * @param stack
 */
export function isDistantStack(stack: Stack): boolean {
    return isProdStack(stack) || isDevStack(stack);
}

/**
 * Get the current wallet url
 * @param stack
 */
export function getWalletUrl(stack: Stack): string {
    if (isProdStack(stack)) {
        return "https://nexus.frak.id";
    }
    if (isDevStack(stack)) {
        return "https://nexus-dev.frak.id";
    }
    return "https://localhost:3000";
}

/**
 * Get the current backend url
 * @param stack
 */
export function getBackendUrl(stack: Stack): string {
    if (isProdStack(stack)) {
        return "https://backend.frak.id";
    }
    if (isDevStack(stack)) {
        return "https://backend-dev.frak.id";
    }
    return "https://localhost:3030";
}
