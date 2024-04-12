import {
    getTransport,
    mainnetChains,
    testnetChains,
} from "@/context/common/blockchain/provider";
import { smartAccountConnector } from "@/context/wallet/smartWallet/connector";
import { isMainnetEnableAtom } from "@/module/settings/atoms/betaOptions";
import { atom } from "jotai";
import { createClient } from "viem";
import { createConfig } from "wagmi";

/**
 * The atom with our smart wallet connector
 */
export const smartWalletConnectAtom = atom((get) => {
    // TODO: Check the current session to provider the initial builder
    return smartAccountConnector({
        initialAccountBuilder: undefined,
    });
});

/**
 * The atom with our wagmi config
 */
export const wagmiConfigAtom = atom((get) => {
    // Get the chain for the current env
    const isMainnet = get(isMainnetEnableAtom);
    const connector = get(smartWalletConnectAtom);

    // Then, create the config and return it
    return createConfig({
        chains: isMainnet ? mainnetChains : testnetChains,
        connectors: [connector],
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
});
