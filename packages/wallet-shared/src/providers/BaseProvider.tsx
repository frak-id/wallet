import { getTransport } from "@frak-labs/app-essentials/blockchain";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { createClient } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { currentChain } from "../blockchain/provider";
import { smartAccountConnector } from "../wallet/smartWallet/connector";

/**
 * Wagmi provider with dynamic configuration
 * Shared between wallet and listener apps
 */
export function WagmiProviderWithDynamicConfig({
    children,
}: PropsWithChildren) {
    const config = useMemo(
        () =>
            createConfig({
                chains: [currentChain],
                connectors: [smartAccountConnector()],
                multiInjectedProviderDiscovery: false,
                client: ({ chain }) =>
                    createClient({
                        chain,
                        transport: getTransport({ chain }),
                        cacheTime: 60_000,
                        batch: {
                            multicall: {
                                wait: 50,
                            },
                        },
                    }),
            }),
        []
    );
    return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
