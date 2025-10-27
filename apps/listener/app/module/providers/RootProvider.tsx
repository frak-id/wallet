import { WagmiProviderWithDynamicConfig } from "@frak-labs/wallet-shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

/**
 * The query client for TanStack Query
 * Simpler config than wallet app (no persistence needed for iframe)
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 5 * 60 * 1000, // 5 minutes
            staleTime: 60 * 1000, // 1 minute
            retry: 1, // Reduced retries for iframe context
        },
    },
});

/**
 * Root provider for the listener app
 * Provides QueryClient and Wagmi to the app
 */
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProviderWithDynamicConfig>
                {children}
            </WagmiProviderWithDynamicConfig>
        </QueryClientProvider>
    );
}
