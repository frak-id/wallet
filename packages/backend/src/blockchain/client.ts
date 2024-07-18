import { DI } from "@frak-labs/shared/context/utils/di";
import { Config } from "sst/node/config";
import { http, type Chain, createClient } from "viem";
import { arbitrumSepolia } from "viem/chains";

const chain = arbitrumSepolia;

export const getViemClient = DI.registerAndExposeGetter({
    id: "ViemClient",
    isAsync: false,
    getter: () => {
        return createClient({
            chain,
            transport: http(getAlchemyRpcUrl({ chain }), {
                batch: {
                    wait: 50,
                },
                retryCount: 3,
                retryDelay: 300,
                timeout: 30_000,
            }),
        });
    },
});

/**
 * Get the alchemy rpc url for the given chain
 * @param chain
 * @param version
 */
function getAlchemyRpcUrl({ chain }: { chain: Chain }) {
    // Get the network name
    let networkName: string;
    if (chain.id === 421614) {
        networkName = "arb-sepolia";
    } else if (chain.id === 42161) {
        networkName = "arb-mainnet";
    } else {
        throw new Error(`No alchemy rpc url for chain ${chain.id}`);
    }

    // Build the alchemy rpc url depending on the chain
    return `https://${networkName}.g.alchemy.com/v2/${Config.ALCHEMY_API_KEY}`;
}
