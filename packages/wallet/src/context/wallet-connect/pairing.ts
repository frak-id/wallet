import { getAvailableChains } from "@/context/wallet-connect/namespace";
import type { ProposalTypes } from "@walletconnect/types";
import { type Chain, extractChain } from "viem";
import * as viemSupportedChains from "viem/chains";

/**
 * Extract all the chains from the namespace
 * @param namespace
 */
const extractAllChains = (namespace: ProposalTypes.RequiredNamespaces) =>
    Object.values(namespace).flatMap((namespace) => {
        return namespace.chains || [];
    });

/**
 * Get the chain name from the chain id
 * @param chain
 */
function getChainName(chain: string) {
    // If it doesn't start with eip155, return the chain
    if (!chain.startsWith("eip155:")) {
        return chain;
    }

    // Remove eip115: from the chain
    const chainId = Number.parseInt(chain.replace("eip155:", ""));
    // Get the chain name from viem
    return (
        extractChain<readonly Chain[], number>({
            chains: Object.values(viemSupportedChains),
            id: chainId,
        })?.name ?? chain
    );
}

/**
 * Check the request chains during the pairing process
 * @param requiredNamespaces
 * @param optionalNamespaces
 */
export function checkRequestedChain(
    requiredNamespaces: ProposalTypes.RequiredNamespaces,
    optionalNamespaces: ProposalTypes.RequiredNamespaces
): {
    supported: string[];
    requiredMissing: string[];
    optionalMissing: string[];
} {
    if (!requiredNamespaces) {
        return {
            supported: [],
            requiredMissing: [],
            optionalMissing: [],
        };
    }

    // Extract every chains
    const required = extractAllChains(requiredNamespaces);
    const optional = extractAllChains(optionalNamespaces);

    // Check if the requested chains are supported
    const availableChains = getAvailableChains();

    // Compare again the available chains
    const supported = [...required, ...optional].filter((chain) =>
        availableChains.includes(chain)
    );

    // Get the missing chains
    const requiredMissing = required.filter(
        (chain) => !supported.includes(chain)
    );
    const optionalMissing = optional.filter(
        (chain) => !supported.includes(chain)
    );

    console.log("Supported chains", {
        availableChains,
        supported,
        required,
        optional,
        requiredMissing,
        optionalMissing,
    });

    // Format each chain using the chain name
    return {
        supported: supported.map((chain) => getChainName(chain)),
        requiredMissing: requiredMissing.map((chain) => getChainName(chain)),
        optionalMissing: optionalMissing.map((chain) => getChainName(chain)),
    };
}

/**
 * Check if the URI is a valid WalletConnect URI
 * @param uri
 */
export function isValidConnectionUri(uri: string) {
    try {
        const url = new URL(uri);
        return (
            url.protocol === "wc:" &&
            url.searchParams.get("relay-protocol") !== null &&
            url.searchParams.get("symKey") !== null
        );
    } catch (error) {
        console.log("Invalid WalletConnect URI", error);
        return false;
    }
}
