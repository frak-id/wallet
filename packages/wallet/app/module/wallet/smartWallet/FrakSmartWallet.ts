import { baseFrakWallet } from "@/module/wallet/smartWallet/baseFrakWallet";
import {
    type SmartAccountV06,
    getAccountAddress,
} from "@/module/wallet/smartWallet/utils";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
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
import { formatSignature, getStubSignature } from "./webAuthN";

export type FrakWebAuthNWallet = SmartAccountV06;

/**
 * Build a kernel smart account from a webauthn credential
 * @param client
 * @param authenticatorId
 * @param signerPubKey
 * @param signatureProvider
 * @param deployedAccountAddress
 */
export async function frakWalletSmartAccount<
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        authenticatorId,
        signerPubKey,
        signatureProvider,
        preDeterminedAccountAddress,
    }: {
        authenticatorId: string;
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        preDeterminedAccountAddress?: Address;
    }
): Promise<FrakWebAuthNWallet> {
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

    // Helper to perform a signature of a hash
    const signHash = async ({ hash }: { hash: Hex }) => {
        // Sign the hash with the sig provider
        const { authenticatorData, clientData, challengeOffset, signature } =
            await signatureProvider(hash);

        // Encode the signature with the web auth n validator info
        return formatSignature({
            authenticatorIdHash,
            rs: [BigInt(signature.r), BigInt(signature.s)],
            challengeOffset,
            authenticatorData,
            clientData,
        });
    };

    // Get the stub signature
    const stubSignature = getStubSignature({ authenticatorIdHash });

    return baseFrakWallet(client, {
        stubSignature,
        getSignature: signHash,
        generateInitCode,
        preDeterminedAccountAddress,
    });
}
