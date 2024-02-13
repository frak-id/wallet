"use client";

import { rpcTransport } from "@/context/common/blockchain/provider";
import { ClientOnly } from "@/module/common/component/ClientOnly";
import { PaywallProvider } from "@/module/paywall/provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { polygonMumbai } from "viem/chains";
import { WagmiProvider, createConfig } from "wagmi";

// The query client that will be used by tanstack/react-query
const queryClient = new QueryClient();

// The wagmi config
const wagmiConfig = createConfig({
    chains: [polygonMumbai],
    transports: {
        [polygonMumbai.id]: rpcTransport,
    },
});

// TODO: Include a small 'build with ZeroDev and Permissionless' on the bottom
export function RootProvider({ children }: PropsWithChildren) {
    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
                <ClientOnly>
                    <PaywallProvider>{children}</PaywallProvider>
                </ClientOnly>
            </WagmiProvider>
        </QueryClientProvider>
    );
}
