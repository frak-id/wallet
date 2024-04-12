import {
    getTransport,
    mainnetChains,
    testnetChains,
} from "@/context/common/blockchain/provider";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { smartAccountBuilderAtom } from "@/module/common/atoms/connector";
import { isMainnetEnableAtom } from "@/module/settings/atoms/betaOptions";
import { atom } from "jotai";
import { createClient } from "viem";
import { createConfig } from "wagmi";

const connectorsAtom = atom((get) => {
    const accountBuilder = get(smartAccountBuilderAtom);
    return accountBuilder ? [smartAccountConnector({ accountBuilder })] : [];
});

/**
 * The atom with our wagmi config
 */
export const wagmiConfigAtom = atom((get) => {
    // Get the chain for the current env
    const isMainnet = get(isMainnetEnableAtom);
    const connectors = get(connectorsAtom);

    // Then, create the config and return it
    return createConfig({
        chains: isMainnet ? mainnetChains : testnetChains,
        connectors: connectors,
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
    });

    // TODO: Here we can access the created connector
});
