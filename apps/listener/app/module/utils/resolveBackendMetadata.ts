import type { ResolvedSdkConfig } from "@frak-labs/backend-elysia/api/schemas";
import type { FrakWalletSdkConfig } from "@frak-labs/core-sdk";

type BackendMetadata = {
    appName: string;
    logoUrl: string | undefined;
    homepageLink: string | undefined;
};

/**
 * Resolve metadata by merging SDK config (from code) with backend config (from dashboard).
 * Priority: SDK config > backend config > defaults.
 *
 * Note: `backendConfig` should come from a Zustand store subscription (hook),
 * not from `getState()`, to avoid staleness.
 */
export function resolveBackendMetadata(
    configMetadata: FrakWalletSdkConfig["metadata"] | undefined,
    backendConfig: ResolvedSdkConfig | undefined
): BackendMetadata {
    return {
        appName: configMetadata?.name ?? backendConfig?.name ?? "",
        logoUrl: configMetadata?.logoUrl ?? backendConfig?.logoUrl,
        homepageLink:
            configMetadata?.homepageLink ?? backendConfig?.homepageLink,
    };
}
