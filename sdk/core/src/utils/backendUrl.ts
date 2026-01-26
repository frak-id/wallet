/**
 * Default production backend URL
 */
const DEFAULT_BACKEND_URL = "https://backend.frak.id";

/**
 * Check if wallet URL is local development (port 3000 or 3010)
 */
function isLocalDevelopment(walletUrl: string): boolean {
    return (
        walletUrl.includes("localhost:3000") ||
        walletUrl.includes("localhost:3010")
    );
}

/**
 * Derive backend URL from wallet URL
 * Maps wallet URLs to their corresponding backend URLs
 */
function deriveBackendUrl(walletUrl: string): string {
    if (isLocalDevelopment(walletUrl)) {
        return "http://localhost:3030";
    }
    // Dev environment
    if (
        walletUrl.includes("wallet-dev.frak.id") ||
        walletUrl.includes("wallet.gcp-dev.frak.id")
    ) {
        return "https://backend.gcp-dev.frak.id";
    }
    // Production
    return DEFAULT_BACKEND_URL;
}

/**
 * Get the backend URL for API calls
 * Tries to derive from SDK config, falls back to production
 *
 * @param walletUrl - Optional wallet URL to derive from (overrides global config)
 */
export function getBackendUrl(walletUrl?: string): string {
    // If explicit walletUrl provided, derive from it
    if (walletUrl) {
        return deriveBackendUrl(walletUrl);
    }

    // Try to get from global FrakSetup config
    if (typeof window !== "undefined") {
        const configWalletUrl = (
            window as {
                FrakSetup?: { client?: { config?: { walletUrl?: string } } };
            }
        ).FrakSetup?.client?.config?.walletUrl;

        if (configWalletUrl) {
            return deriveBackendUrl(configWalletUrl);
        }
    }

    // Fallback to production
    return DEFAULT_BACKEND_URL;
}
