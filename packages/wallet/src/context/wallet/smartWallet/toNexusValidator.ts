import { kernelAddresses } from "@/context/common/blockchain/addresses";
import { getValidatorEnableData } from "@/context/wallet/smartWallet/utils";
import { isRip7212ChainSupported } from "@/context/wallet/smartWallet/webAuthN";
import type { P256PubKey, WebAuthNSignature } from "@/types/WebAuthN";
import type { KernelValidator } from "@zerodev/sdk/types";
import type { TypedData } from "abitype";
import {
    ENTRYPOINT_ADDRESS_V07,
    type UserOperation,
    getUserOperationHash,
} from "permissionless";
import { SignTransactionNotSupportedBySmartAccount } from "permissionless/accounts";
import type {
    ENTRYPOINT_ADDRESS_V07_TYPE,
    GetEntryPointVersion,
} from "permissionless/types";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type LocalAccount,
    type SignTypedDataParameters,
    type Transport,
    type TypedDataDefinition,
    boolToHex,
    concatHex,
    getTypesForEIP712Domain,
    hashMessage,
    hashTypedData,
    keccak256,
    maxUint256,
    numberToHex,
    pad,
    size,
    toHex,
    validateTypedData,
} from "viem";
import { toAccount } from "viem/accounts";
import { getChainId } from "viem/actions";

export type NexusWebAuthNValidator<
    entryPoint extends ENTRYPOINT_ADDRESS_V07_TYPE,
> = KernelValidator<entryPoint, "NexusWebAuthNValidator">;

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
 * Create the nexus validator itself
 * @param client
 * @param authenticatorId
 * @param signerPubKey
 * @param signatureProvider
 * @param entryPointAddress
 */
export async function toNexusValidator<
    entryPoint extends ENTRYPOINT_ADDRESS_V07_TYPE,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
>(
    client: Client<TTransport, TChain, undefined>,
    {
        authenticatorId,
        signerPubKey,
        signatureProvider,
        entryPoint: entryPointAddress = ENTRYPOINT_ADDRESS_V07 as entryPoint,
    }: {
        authenticatorId: string;
        signerPubKey: P256PubKey;
        signatureProvider: (message: Hex) => Promise<WebAuthNSignature>;
        entryPoint?: entryPoint;
    }
): Promise<NexusWebAuthNValidator<entryPoint>> {
    const validatorAddress = kernelAddresses.v3.multiWebAuthnValidator;

    const authenticatorIdHash = keccak256(toHex(authenticatorId));

    const chainId = client?.chain?.id ?? (await getChainId(client));

    // Helper to perform a signature of a hash
    const isRip7212Supported = isRip7212ChainSupported(chainId);
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

    // build account with passkey
    const account: LocalAccount = toAccount({
        // note that this address will be overwritten by actual address
        address: "0x0000000000000000000000000000000000000000",

        /**
         * Sign the given transaction
         * @param _
         * @param __
         */
        async signTransaction(_, __) {
            throw new SignTransactionNotSupportedBySmartAccount();
        },

        /**
         * Sign the given message
         * @param message
         */
        async signMessage({ message }) {
            return signHash(hashMessage(message));
        },
        /**
         * Sign the given typed data
         * @param typedData
         */
        async signTypedData<
            const TTypedData extends TypedData | Record<string, unknown>,
            TPrimaryType extends
                | keyof TTypedData
                | "EIP712Domain" = keyof TTypedData,
        >(typedData: TypedDataDefinition<TTypedData, TPrimaryType>) {
            const { domain, message, primaryType } =
                typedData as unknown as SignTypedDataParameters;

            const types = {
                EIP712Domain: getTypesForEIP712Domain({ domain }),
                ...typedData.types,
            };

            validateTypedData({ domain, message, primaryType, types });

            const hash = hashTypedData(typedData);
            return signHash(hash);
        },
    });

    return {
        ...account,
        validatorType: "SECONDARY",
        address: validatorAddress,
        source: "NexusWebAuthNValidator",

        /**
         * Get the identifier for this validator
         */
        getIdentifier() {
            return validatorAddress;
        },

        /**
         * Get the enable data for this validator
         */
        async getEnableData() {
            return getValidatorEnableData({
                authenticatorIdHash,
                signerPubKey,
            });
        },

        /**
         * Get the nonce key
         * @param _accountAddress
         * @param customNonceKey
         */
        async getNonceKey(_accountAddress?: Address, customNonceKey?: bigint) {
            if (customNonceKey) {
                return customNonceKey;
            }
            return 0n;
        },

        /**
         * Sign the given user operation
         * @param userOperation
         */
        async signUserOperation(
            userOperation: UserOperation<GetEntryPointVersion<entryPoint>>
        ) {
            // Get the hash of the user op and return it
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    signature: "0x",
                },
                entryPoint: entryPointAddress,
                chainId: chainId,
            });
            return signHash(hash);
        },

        /**
         * Get a dummy signature for our validator
         */
        async getDummySignature() {
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

        /**
         * Check if the validator is enabled
         * TODO: Checking what exactly?
         * @param _kernelAccountAddress
         * @param _selector
         */
        async isEnabled(
            _kernelAccountAddress: Address,
            _selector: Hex
        ): Promise<boolean> {
            return false;
        },
    };
}
