import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { WagmiProviderWithDynamicConfig } from "@frak-labs/wallet-shared/providers/BaseProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai";
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
 * Provides QueryClient, Jotai store, and Wagmi to the app
 */
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <Provider store={jotaiStore}>
            <QueryClientProvider client={queryClient}>
                <WagmiProviderWithDynamicConfig>
                    {children}
                </WagmiProviderWithDynamicConfig>
            </QueryClientProvider>
        </Provider>
    );
}
