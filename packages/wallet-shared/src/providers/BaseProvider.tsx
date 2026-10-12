import { getTransport } from "@frak-labs/app-essentials/blockchain";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { createClient } from "viem";
import { createConfig, createStorage, noopStorage, WagmiProvider } from "wagmi";
import { currentChain } from "../blockchain/provider";
import { smartAccountConnector } from "../wallet/smartWallet/connector";

// wagmi's default storage, minus its `window.localStorage` read that throws when storage is denied (third-party iframe, Incognito).
function localStorageIfAllowed(): Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
> {
    try {
        const storage = window.localStorage;
        return {
            getItem: (key) => storage.getItem(key),
            removeItem: (key) => storage.removeItem(key),
            setItem: (key, value) => {
                try {
                    storage.setItem(key, value);
                } catch {}
            },
        };
    } catch {
        return noopStorage;
    }
}

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
                storage: createStorage({ storage: localStorageIfAllowed() }),
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
