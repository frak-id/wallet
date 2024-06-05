import { availableChains } from "@/context/blockchain/provider";
import type { ProposalTypes } from "@walletconnect/types";
import { buildApprovedNamespaces } from "@walletconnect/utils";

/**
 * Get the available chains for the wallet connect
 *  - We add two mainnet chains to ease the usage
 */
export const getAvailableChains = () =>
    availableChains.map((chain) => `eip155:${chain.id}`);

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
                    // Send transaction method (TODO: Not rly supported but required for test)
                    "eth_sendTransaction",
                ],
                events: ["accountsChanged", "chainChanged"],
                accounts: chainsAvailable.flatMap(
                    (chain) => `${chain}:${address}`
                ),
            },
        },
    });
}
