import type { Stack } from "sst/constructs";

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
    return "http://localhost:3000";
}
