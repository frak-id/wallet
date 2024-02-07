"use client";

import { rpcTransport } from "@/context/common/blockchain/provider";
import { useLaunchQueue } from "@/module/common/hook/useLaunchQueue";
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
    // Define the launch queue callback on the top level of the app
    const { isSupported, lastParams } = useLaunchQueue();

    return (
        <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
                {children}
                <p>Launch queue supported? {JSON.stringify(isSupported)}</p>
                <p>Last launch queue params {JSON.stringify(lastParams)}</p>
            </WagmiProvider>
        </QueryClientProvider>
    );
}
