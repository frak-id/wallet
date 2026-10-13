import { getTransport } from "@frak-labs/app-essentials/blockchain";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { createClient } from "viem";
import { createConfig, createStorage, noopStorage, WagmiProvider } from "wagmi";
import { currentChain } from "../blockchain/provider";
import { localStorageIfAllowed } from "../common/utils/browserStorage";
import { smartAccountConnector } from "../wallet/smartWallet/connector";

// wagmi's default storage, minus its `window.localStorage` read that throws when storage is denied (third-party iframe, Incognito).
function wagmiStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
    const storage = localStorageIfAllowed();
    if (!storage) return noopStorage;
    return {
        getItem: (key) => storage.getItem(key),
        removeItem: (key) => storage.removeItem(key),
        setItem: (key, value) => {
            try {
                storage.setItem(key, value);
            } catch {}
        },
    };
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
                storage: createStorage({ storage: wagmiStorage() }),
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
