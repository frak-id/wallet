import {
    getTransport,
    mainnetChains,
    testnetChains,
} from "@/context/common/blockchain/provider";
import { connectorsAtom } from "@/module/common/atoms/connector";
import { isMainnetEnableAtom } from "@/module/settings/atoms/betaOptions";
import { atom } from "jotai";
import { createClient } from "viem";
import { createConfig } from "wagmi";

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
        connectors,
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
