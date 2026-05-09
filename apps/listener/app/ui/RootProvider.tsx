import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { queryClient } from "@/queryClient";

/**
 * Root provider for the listener Ring 1 tree.
 *
 * Wraps children in a plain `QueryClientProvider` pointing at the SAME
 * vanilla QueryClient singleton that Ring 0 uses. Persistence
 * (sessionStorage hydration + dehydration) is wired in `app/queryClient.ts`
 * via `ensureHydrated()` — bootstrap kicks it off on iframe load so
 * cached entries are available even before this provider mounts.
 *
 * Notes:
 *  - `WagmiProviderWithDynamicConfig` is intentionally NOT mounted here.
 *    It is moved into the lazy-loaded modal + embedded-wallet boundaries
 *    via `BlockchainProvider`, so the wagmi/viem/permissionless graph
 *    stays out of the eager iframe bundle.
 *  - `usePersistentPairingClient` is also NOT mounted here. Pairing is
 *    only consumed by the Modal + Embedded Wallet UI trees (signature
 *    requests, smart-wallet ops). Mounting it inside those trees instead
 *    of eagerly here keeps the WebSocket dormant until a partner site
 *    triggers UI — reducing idle backend WS load.
 */
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
