import type { currentViemClient } from "@/context/blockchain/provider";
import {
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/context/wallet/smartWallet/signature";
import {
    type SmartAccountV06,
    getAccountAddress,
    isAlreadyFormattedCall,
} from "@/context/wallet/smartWallet/utils";
import { isRip7212ChainSupported } from "@/context/wallet/smartWallet/webAuthN";
import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import { KernelExecuteAbi } from "@frak-labs/app-essentials";
import { WebAuthN, kernelAddresses } from "@frak-labs/app-essentials";
import { isSmartAccountDeployed } from "permissionless";
import { getAccountNonce } from "permissionless/actions";
import { memo, tryit } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    boolToHex,
    concatHex,
    encodeFunctionData,
    hashMessage,
    hashTypedData,
    isAddressEqual,
    keccak256,
    maxUint256,
    numberToHex,
    pad,
    size,
    toHex,
} from "viem";
import {
    entryPoint06Abi,
    entryPoint06Address,
    getUserOperationHash,
    toSmartAccount,
} from "viem/account-abstraction";
import { estimateGas } from "viem/actions";

export type NexusSmartAccount = SmartAccountV06;

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
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
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
): Promise<NexusSmartAccount> {
    const authenticatorIdHash = keccak256(toHex(authenticatorId));
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        WebAuthN.getWebAuthNSmartWalletInitCode({
            authenticatorIdHash,
            signerPubKey,
        });

    // Fetch account address and chain id
    const computedAccountAddress = await getAccountAddress({
        client,
        initCodeProvider: generateInitCode,
    });

    if (!computedAccountAddress) throw new Error("Account address not found");

    // Check if we can handle account creation or not
    const canCreateAccount = preDeterminedAccountAddress
        ? isAddressEqual(computedAccountAddress, preDeterminedAccountAddress)
        : true;

    // The account address to use
    const accountAddress =
        preDeterminedAccountAddress ?? computedAccountAddress;

    // Helper to check if the smart account is already deployed (with caching)
    const isKernelAccountDeployed = memo(
        async () => {
            return await isSmartAccountDeployed(client, accountAddress);
        },
        { key: () => `${accountAddress}-id-deployed` }
    );

    // Helper fetching the account metadata (used for msg signing)
    const getAccountMetadata = memo(
        async () => {
            return await fetchAccountMetadata(client, accountAddress);
        },
        { key: () => `${accountAddress}-metadata` }
    );

    // Helper to perform a signature of a hash
    const isRip7212Supported = isRip7212ChainSupported(client.chain.id);
    const signHash = async (hash: Hex) => {
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

    // Build the smart account itself
    return toSmartAccount({
        client,
        // Entry point config
        entryPoint: {
            version: "0.6",
            abi: entryPoint06Abi,
            address: entryPoint06Address,
        },
        // Account address
        getAddress: async () => accountAddress,
        // Encode calls
        async encodeCalls(calls) {
            if (calls.length > 1) {
                // Encode a batched call
                return encodeWalletMulticall(calls);
            }
            const call = calls[0];
            // If the target is the current smart wallet, don't sur-encode it
            if (
                isAlreadyFormattedCall({
                    wallet: accountAddress,
                    to: call.to,
                    data: call.data ?? "0x",
                })
            ) {
                return call.data ?? "0x";
            }

            // Encode a simple call
            return encodeFunctionData({
                abi: KernelExecuteAbi,
                functionName: "execute",
                args: [call.to, call.value ?? 0n, call.data ?? "0x", 0],
            });
        },
        // Factory args
        async getFactoryArgs() {
            if (!canCreateAccount) {
                return { factory: undefined, factoryData: undefined };
            }
            if (await isKernelAccountDeployed()) {
                return { factory: undefined, factoryData: undefined };
            }
            return {
                factory: kernelAddresses.factory,
                factoryData: generateInitCode(),
            };
        },
        // Get nonce
        async getNonce() {
            return getAccountNonce(client, {
                address: accountAddress,
                entryPointAddress: entryPoint06Address,
            });
        },

        // Sign simple hash
        async sign({ hash }) {
            console.log("Want to signe a simple hash", hash);
            const metadata = await getAccountMetadata();
            const challenge = wrapMessageForSignature({
                message: hash,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },
        // Sign a message
        async signMessage({ message }) {
            const hashedMessage = hashMessage(message);
            const metadata = await getAccountMetadata();
            const challenge = wrapMessageForSignature({
                message: hashedMessage,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },
        // Sign typed data
        async signTypedData(typedData) {
            const typedDataHash = hashTypedData(typedData);
            const metadata = await getAccountMetadata();
            const challenge = wrapMessageForSignature({
                message: typedDataHash,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },
        // Sign user operation
        async signUserOperation(userOperation) {
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    sender: userOperation.sender ?? accountAddress,
                    signature: "0x",
                },
                entryPointAddress: entryPoint06Address,
                entryPointVersion: "0.6",
                chainId: client.chain.id,
            });
            const encodedSignature = await signHash(hash);

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },
        // Get dummy sig
        async getStubSignature() {
            // The max curve value for p256 signature stuff
            const maxCurveValue =
                BigInt(
                    "0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551"
                ) - 1n;

            // Generate a template signature for the webauthn validator
            const sig = formatSignature({
                isRip7212Supported,
                authenticatorIdHash,
                challengeOffset: maxUint256,
                rs: [maxCurveValue, maxCurveValue],
                authenticatorData: `0x${maxUint256.toString(16).repeat(6)}`,
                clientData: `0x${maxUint256.toString(16).repeat(6)}`,
            });

            // return the coded signature
            return concatHex(["0x00000000", sig]);
        },
        userOperation: {
            // Custom override for gas estimation
            async estimateGas(userOperation) {
                if (!userOperation.callData) {
                    return undefined;
                }

                const [, estimation] = await tryit(() =>
                    estimateGas(client as typeof currentViemClient, {
                        account: userOperation.sender ?? accountAddress,
                        to: userOperation.sender ?? accountAddress,
                        data: userOperation.callData as Hex,
                    })
                )();
                if (!estimation) {
                    return undefined;
                }
                // Use the estimation with 25% of error margin on the estimation
                return {
                    callGasLimit: (estimation * 125n) / 100n,
                };
            },
        },
    });
}
