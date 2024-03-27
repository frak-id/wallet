import { mumbaiPocClient } from "@/context/common/blockchain/provider";
import { webAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import type { P256PubKey, WebAuthNWallet } from "@/types/WebAuthN";
import { ENTRYPOINT_ADDRESS_V06 } from "permissionless";

/**
 * Format a wallet
 * @param authenticatorId
 * @param publicKey
 */
export async function formatWallet({
    authenticatorId,
    publicKey,
}: {
    authenticatorId: string;
    publicKey: P256PubKey;
}): Promise<WebAuthNWallet> {
    // Build the smart wallet account
    // @ts-ignore
    const smartWallet = await webAuthNSmartAccount(mumbaiPocClient, {
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        authenticatorId,
        signerPubKey: publicKey,
        signatureProvider: async () => {
            throw new Error("Read only wallet");
        },
    });

    return {
        address: smartWallet.address,
        publicKey,
        authenticatorId,
    };
}
