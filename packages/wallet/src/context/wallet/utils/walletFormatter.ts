import { frakChainPocClient } from "@/context/common/blockchain/provider";
import {
    getAccountAddress,
    getAccountInitCode,
} from "@/context/wallet/smartWallet/utils";
import type { P256PubKey, WebAuthNWallet } from "@/types/WebAuthN";
import { type Address, keccak256, toHex } from "viem";

/**
 * Format a wallet
 * @param authenticatorId
 * @param publicKey
 * @param previousWallet
 */
export async function formatWallet({
    authenticatorId,
    publicKey,
    previousWallet,
}: {
    authenticatorId: string;
    publicKey: P256PubKey;
    previousWallet?: Address;
}): Promise<WebAuthNWallet> {
    // Estimate the smart wallet address
    const smartWalletAddress =
        previousWallet ??
        (await predicateSmartWalletAddress({
            authenticatorId,
            publicKey,
        }));

    return {
        address: smartWalletAddress,
        publicKey,
        authenticatorId,
    };
}

/**
 * Predicate the smart wallet address
 * @param authenticatorId
 * @param publicKey
 */
async function predicateSmartWalletAddress({
    authenticatorId,
    publicKey,
}: {
    authenticatorId: string;
    publicKey: P256PubKey;
}) {
    const authenticatorIdHash = keccak256(toHex(authenticatorId));
    return getAccountAddress({
        client: frakChainPocClient,
        initCodeProvider: () =>
            getAccountInitCode({
                authenticatorIdHash,
                signerPubKey: publicKey,
            }),
    });
}
