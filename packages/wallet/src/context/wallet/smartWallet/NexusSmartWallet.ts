import { kernelAddresses } from "@/context/blockchain/addresses";
import { KernelExecuteAbi } from "@/context/wallet/abi/kernel-account-abis";
import {
    type AccountMetadata,
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/context/wallet/smartWallet/signature";
import {
    getAccountAddress,
    getAccountInitCode,
} from "@/context/wallet/smartWallet/utils";
import { isRip7212ChainSupported } from "@/context/wallet/smartWallet/webAuthN";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import {
    ENTRYPOINT_ADDRESS_V06,
    getAccountNonce,
    getUserOperationHash,
    isSmartAccountDeployed,
} from "permissionless";
import {
    SignTransactionNotSupportedBySmartAccount,
    type SmartAccount,
    toSmartAccount,
} from "permissionless/accounts";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
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

export type NexusSmartAccount<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<
    ENTRYPOINT_ADDRESS_V06_TYPE,
    "nexusSmartAccount",
    transport,
    chain
>;

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
export async function nexusSmartAccount<
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
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
): Promise<NexusSmartAccount<TTransport, TChain>> {
    const authenticatorIdHash = keccak256(toHex(authenticatorId));
    // Helper to generate the init code for the smart account
    const generateInitCode = () =>
        getAccountInitCode({
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
    let smartAccountDeployed = false;
    const isKernelAccountDeployed = async () => {
        if (smartAccountDeployed) return true;
        smartAccountDeployed = await isSmartAccountDeployed(
            client,
            accountAddress
        );
        return smartAccountDeployed;
    };

    // Helper fetching the account metadata (used for msg signing)
    let accountMetadata: AccountMetadata | undefined = undefined;
    const getAccountMetadata = async () => {
        if (accountMetadata) return accountMetadata;
        // Fetch the account metadata
        accountMetadata = await fetchAccountMetadata(client, accountAddress);
        return accountMetadata;
    };

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
        address: accountAddress,

        client: client,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        source: "nexusSmartAccount",

        /**
         * Get the smart account nonce
         */
        async getNonce() {
            return getAccountNonce(client, {
                sender: accountAddress,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
            });
        },

        /**
         * Get the smart account factory
         */
        async getFactory() {
            if (await isKernelAccountDeployed()) return undefined;
            if (!canCreateAccount) return undefined;
            return kernelAddresses.factory;
        },

        /**
         * Get the smart account factory data
         */
        async getFactoryData() {
            if (await isKernelAccountDeployed()) return undefined;
            if (!canCreateAccount) return undefined;
            return generateInitCode();
        },

        /**
         * Generate the account init code
         */
        async getInitCode() {
            if (await isKernelAccountDeployed()) return "0x";
            if (!canCreateAccount) {
                throw new Error(
                    "Cannot create account with mismatching pre-determined address"
                );
            }
            return concatHex([kernelAddresses.factory, generateInitCode()]);
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
        async signUserOperation(userOperation) {
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    signature: "0x",
                },
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chainId: client.chain.id,
            });
            const encodedSignature = await signHash(hash);

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },

        /**
         * Sign a message
         * @param message
         */
        async signMessage({ message }) {
            const metadata = await getAccountMetadata();
            // Encode the msg and wrap it
            const hashedMessage = hashMessage(message);
            const challenge = wrapMessageForSignature({
                message: hashedMessage,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },

        /**
         * Sign a given transaction
         * @param _
         * @param __
         */
        async signTransaction(_, __) {
            throw new SignTransactionNotSupportedBySmartAccount();
        },

        /**
         * Sign typed data
         */
        async signTypedData(typedData) {
            const metadata = await getAccountMetadata();
            // Encode the msg and wrap it
            const typedDataHash = hashTypedData(typedData);
            const challenge = wrapMessageForSignature({
                message: typedDataHash,
                metadata,
            });
            // And sign it
            return signHash(challenge);
        },

        /**
         * Encode the deployment call data of this account
         * TODO: It's supported, just need to dev it
         * @param _
         */
        async encodeDeployCallData(_) {
            throw new Error(
                "WebAuthN account doesn't support account deployment"
            );
        },

        /**
         * Encode transaction call data for this smart account
         * @param _tx
         */
        async encodeCallData(_tx) {
            if (Array.isArray(_tx)) {
                // Encode a batched call
                return encodeFunctionData({
                    abi: KernelExecuteAbi,
                    functionName: "executeBatch",
                    args: [
                        _tx.map((tx) => ({
                            to: tx.to,
                            value: tx.value,
                            data: tx.data,
                        })),
                    ],
                });
            }
            // Encode a simple call
            return encodeFunctionData({
                abi: KernelExecuteAbi,
                functionName: "execute",
                args: [_tx.to, _tx.value, _tx.data, 0],
            });
        },

        /**
         * Get a dummy signature for this smart account
         */
        async getDummySignature() {
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
    });
}
