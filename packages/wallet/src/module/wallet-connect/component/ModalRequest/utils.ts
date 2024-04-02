import type { ProposalTypes } from "@walletconnect/types";
import { buildApprovedNamespaces } from "@walletconnect/utils";

export const chainsAvailable = [
    // Polygon mumbai and amoy
    "eip155:80001",
    "eip155:80002",
    // Polygon mainnet
    "eip155:137",
    // Arbitrum sepolia
    "eip155:421614",
    // Arbitrum mainnet
    "eip155:42161",
];
export const chainsNames = ["Polygon", "Arbitrum"];

/**
 * Get the namespaces from the proposal
 * @param params
 * @param address
 */
export function getNamespaces(params: ProposalTypes.Struct, address: string) {
    return buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces: {
            eip155: {
                chains: chainsAvailable,
                methods: [
                    // Signature stuff
                    "personal_sign",
                    "eth_sign",
                    // Typed data signature
                    //"eth_signTypedData",
                    //"eth_signTypedData_v3",
                    //"eth_signTypedData_v4",
                    // Sending tx
                    //"eth_sendTransaction",
                ],
                events: ["accountsChanged", "chainChanged"],
                accounts: chainsAvailable.flatMap(
                    (chain) => `${chain}:${address}`
                ),
            },
        },
    });
}

/**
 * Get the chains from the namespace
 * @param namespace
 */
function getChains(namespace: ProposalTypes.RequiredNamespaces) {
    let chains: ProposalTypes.RequiredNamespace["chains"] = [];
    for (const requiredChain in namespace) {
        const chain = namespace[requiredChain].chains;
        if (!chain) return [];
        chains = [...chains, ...chain];
    }
    return chains;
}

/**
 * Get the requested chains from the required and optional namespaces
 * @param requiredNamespaces
 * @param optionalNamespaces
 */
function getRequestedChains(
    requiredNamespaces: ProposalTypes.RequiredNamespaces,
    optionalNamespaces: ProposalTypes.RequiredNamespaces
) {
    if (!requiredNamespaces) return [];
    const required = getChains(requiredNamespaces);
    const optional = getChains(optionalNamespaces);
    return [...new Set([...required, ...optional])];
}

/**
 * Get the supported chains from the requested chains
 * @param requestedChains
 */
function getSupportedChains(requestedChains: string[]) {
    return requestedChains
        .map((chain) => {
            const chainSupported = chainsAvailable.find(
                (chainAvailable) => chainAvailable === chain
            );
            if (!chainSupported) return undefined;
            return chainSupported;
        })
        .filter(Boolean);
}

/**
 * Get the not supported chains from the required and optional namespaces
 * @param requiredNamespaces
 * @param optionalNamespaces
 */
export function getNotSupportedChains(
    requiredNamespaces: ProposalTypes.RequiredNamespaces,
    optionalNamespaces: ProposalTypes.RequiredNamespaces
) {
    if (!requiredNamespaces) return [];
    const required = getChains(requiredNamespaces);
    // Chains requested by the dapp
    const requestedChains = getRequestedChains(
        requiredNamespaces,
        optionalNamespaces
    );
    // Chains supported by our wallet
    const supportedChains = getSupportedChains(requestedChains);
    return required.filter((chain) => !supportedChains.includes(chain));
}
