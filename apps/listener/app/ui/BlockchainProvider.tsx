import { lazy, type PropsWithChildren, Suspense } from "react";

/**
 * Wraps wagmi setup for the lazy modal + embedded-wallet boundaries.
 *
 * `WagmiProviderWithDynamicConfig` is dynamically imported (via a deep
 * `wallet-shared/providers/BaseProvider` subpath, configured in
 * `packages/wallet-shared/package.json`) to keep the entire wagmi /
 * permissionless / viem-account-abstraction graph out of the eager iframe
 * bundle. The dynamic-import boundary is required: without it, Rolldown's
 * static-import graph reaches `blockchain-vendor` from the `common` chunk
 * (via barrel re-exports) and the browser fetches ~80 KB gz of blockchain
 * code on iframe boot — even though the modal/wallet UIs are themselves
 * lazy.
 */
const WagmiProviderLazy = lazy(() =>
    import("@frak-labs/wallet-shared/providers/BaseProvider").then((mod) => ({
        default: mod.WagmiProviderWithDynamicConfig,
    }))
);

export function BlockchainProvider({ children }: PropsWithChildren) {
    return (
        <Suspense fallback={null}>
            <WagmiProviderLazy>{children}</WagmiProviderLazy>
        </Suspense>
    );
}
