import { availableChains } from "@/context/common/blockchain/provider";
import type { ProposalTypes } from "@walletconnect/types";
import { buildApprovedNamespaces } from "@walletconnect/utils";

/**
 * Get the available chains for the wallet connect
 *  - We add two mainnet chains to ease the usage
 */
export const getAvailableChains = () => {
    const currentChain = availableChains.map((chain) => `eip155:${chain.id}`);

    return [
        ...currentChain,
        // Polygon mainnet
        "eip155:137",
        // Arbitrum mainnet
        "eip155:42161",
    ];
};

/**
 * Get the namespaces from the proposal
 * @param params
 * @param address
 */
export function getNamespaces(params: ProposalTypes.Struct, address: string) {
    const chainsAvailable = getAvailableChains();
    return buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
            eip155: {
                chains: chainsAvailable,
                methods: [
                    // Simple signature
                    "personal_sign",
                    "eth_sign",
                    // Typed data signature
                    "eth_signTypedData",
                    "eth_signTypedData_v3",
                    "eth_signTypedData_v4",
                ],
                events: ["accountsChanged", "chainChanged"],
                accounts: chainsAvailable.flatMap(
                    (chain) => `${chain}:${address}`
                ),
            },
        },
    });
}
