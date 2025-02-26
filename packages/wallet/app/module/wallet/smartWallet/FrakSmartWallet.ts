import { baseFrakWallet } from "@/module/wallet/smartWallet/baseFrakWallet";
import {
    type SmartAccountV06,
    getAccountAddress,
} from "@/module/wallet/smartWallet/utils";
import { isRip7212ChainSupported } from "@/module/wallet/smartWallet/webAuthN";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import { KernelWallet } from "@frak-labs/app-essentials";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    boolToHex,
    concatHex,
    keccak256,
    maxUint256,
    numberToHex,
    pad,
    size,
    toHex,
} from "viem";

export type FrakWebAuthNWallet = SmartAccountV06;

/**
 * Format the given signature
 */
function formatSignature({
    isRip7212Supported,
    authenticatorIdHash,
    challengeOffset,
    rs,
    authenticatorData,
    clientData,
}: {
    isRip7212Supported: boolean;
    authenticatorIdHash: Hex;
    challengeOffset: bigint;
    rs: [bigint, bigint];
    authenticatorData: Hex;
    clientData: Hex;
}) {
    return concatHex([
        // Metadata stuff
        pad(boolToHex(isRip7212Supported), { size: 1 }),
        pad(authenticatorIdHash, { size: 32 }),
        // Signature info
        numberToHex(challengeOffset, { size: 32, signed: false }),
        numberToHex(rs[0], { size: 32, signed: false }),
        numberToHex(rs[1], { size: 32, signed: false }),
        // The length of each bytes array (uint24 so 3 bytes)
        numberToHex(size(authenticatorData), { size: 3, signed: false }),
        numberToHex(size(clientData), { size: 3, signed: false }),
        // Then the bytes values
        authenticatorData,
        clientData,
    ]);
}

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
    const isRip7212Supported = isRip7212ChainSupported(client.chain.id);
    const signHash = async ({ hash }: { hash: Hex }) => {
        // Sign the hash with the sig provider
        const { authenticatorData, clientData, challengeOffset, signature } =
            await signatureProvider(hash);

        // Encode the signature with the web auth n validator info
        return formatSignature({
            isRip7212Supported,
            authenticatorIdHash,
            rs: [BigInt(signature.r), BigInt(signature.s)],
            challengeOffset,
            authenticatorData,
            clientData,
        });
    };

    return baseFrakWallet(client, {
        getSignature: signHash,
        getStubSignature: () => {
            // The max curve value for p256 signature stuff
            const maxCurveValue =
                BigInt(
                    "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
                ) - 1n;

            // Generate a template signature for the webauthn validator
            return formatSignature({
                isRip7212Supported,
                authenticatorIdHash,
                challengeOffset: maxUint256,
                rs: [maxCurveValue, maxCurveValue],
                authenticatorData: `0x${maxUint256.toString(16).repeat(6)}`,
                clientData: `0x${maxUint256.toString(16).repeat(6)}`,
            });
        },
        generateInitCode,
        preDeterminedAccountAddress,
    });
}
