import { baseFrakWallet } from "@/module/wallet/smartWallet/baseFrakWallet";
import {
    type SmartAccountV06,
    getAccountAddress,
} from "@/module/wallet/smartWallet/utils";
import type { P256PubKey } from "@/types/WebAuthN";
import { KernelWallet } from "@frak-labs/app-essentials";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    keccak256,
    toHex,
} from "viem";
import { getOriginPairingClient } from "../../pairing/clients/store";
import { getStubSignature } from "./webAuthN";

export type FrakPairedWebAuthnWallet = SmartAccountV06;

/**
 * Build a kernel smart account from a webauthn credential
 * @param client
 * @param authenticatorId
 * @param signerPubKey
 * @param signatureProvider
 * @param deployedAccountAddress
 */
export async function frakPairedWalletSmartAccount<
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        authenticatorId,
        signerPubKey,
        preDeterminedAccountAddress,
    }: {
        authenticatorId: string;
        signerPubKey: P256PubKey;
        preDeterminedAccountAddress?: Address;
    }
): Promise<FrakPairedWebAuthnWallet> {
    const authenticatorIdHash = keccak256(toHex(authenticatorId));
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        KernelWallet.getWebAuthNSmartWalletInitCode({
            authenticatorIdHash,
            signerPubKey,
        });

    // Fetch account address and chain id
    const computedAccountAddress = await getAccountAddress({
        client,
        initCodeProvider: generateInitCode,
    });

    if (!computedAccountAddress) throw new Error("Account address not found");

    // Get the current paired origin client
    const originPairingClient = getOriginPairingClient();

    // Helper to perform a signature of a hash
    const signHash = async ({ hash }: { hash: Hex }) =>
        await originPairingClient.sendSignatureRequest(hash);

    // Get the stub signature
    const stubSignature = getStubSignature({ authenticatorIdHash });

    return baseFrakWallet(client, {
        stubSignature,
        getSignature: signHash,
        generateInitCode,
        preDeterminedAccountAddress,
    });
}
