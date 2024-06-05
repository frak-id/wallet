import { kernelAddresses } from "@/context/blockchain/addresses";
import { KernelExecuteAbi } from "@/context/wallet/abi/kernel-account-abis";
import {
    ENTRYPOINT_ADDRESS_V06,
    getAccountNonce,
    getUserOperationHash,
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
    type LocalAccount,
    type Transport,
    concatHex,
    encodeFunctionData,
    pad,
} from "viem";
import { signTypedData } from "viem/actions";

export type NexusRecoverySmartAccount<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<
    ENTRYPOINT_ADDRESS_V06_TYPE,
    "nexusInteractionSignerSmartAccount",
    transport,
    chain
> & {
    /**
     * Method to set the current context
     * @param contentId
     */
    setContentContext: (contentId: Hex) => void;
    /**
     * Method to clear the content context
     * @param contentId
     */
    clearContentContext: () => void;
};

/**
 * Build a kernel smart account for an interaction signer
 * @param client
 * @param sessionAccount
 * @param wallet
 */
export function interactionSessionSmartAccount<
    TAccountSource extends string,
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>(
    client: Client<TTransport, TChain>,
    {
        sessionAccount,
        wallet,
    }: {
        sessionAccount: LocalAccount<TAccountSource>;
        wallet: Address;
    }
): NexusRecoverySmartAccount<TTransport, TChain> {
    if (!wallet) throw new Error("Account address not found");

    // The current content id
    let currentContentId: Hex | undefined;

    // Build the smart account itself
    const smartAccount = toSmartAccount({
        address: wallet,

        client: client,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        source: "nexusInteractionSignerSmartAccount",

        /**
         * Get the smart account nonce
         */
        async getNonce() {
            return getAccountNonce(client, {
                sender: wallet,
                entryPoint: ENTRYPOINT_ADDRESS_V06,
            });
        },

        /**
         * Get the smart account factory
         */
        async getFactory() {
            return undefined;
        },

        /**
         * Get the smart account factory data
         */
        async getFactoryData() {
            return undefined;
        },

        /**
         * Generate the account init code
         */
        async getInitCode() {
            return "0x";
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
        async signUserOperation(userOperation) {
            const userOpHash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    signature: "0x",
                },
                entryPoint: ENTRYPOINT_ADDRESS_V06,
                chainId: client.chain.id,
            });

            // Get the EIP-712 typed data signature
            const signature = await signTypedData(client, {
                account: sessionAccount,
                domain: {
                    name: "Frak.InteractionSessionValidator",
                    version: "0.0.1",
                    chainId: client.chain.id,
                    verifyingContract:
                        kernelAddresses.interactionSessionValidator,
                },
                types: {
                    ValidateInteractionOp: [
                        { name: "contentId", type: "uint256" },
                        { name: "userOpHash", type: "bytes32" },
                    ],
                },
                primaryType: "ValidateInteractionOp",
                message: {
                    contentId: BigInt(currentContentId || pad("0x")),
                    userOpHash: userOpHash,
                },
            });

            // Use it as a plugin, since should be enabled during recovery phase
            return concatHex([
                "0x00000001",
                // Current content id or 32 bytes of 0 instead
                currentContentId || pad("0x"),
                // The EIP-712 signature
                signature,
            ]);
        },

        /**
         * Sign a message
         */
        async signMessage() {
            throw new Error(
                "Recovery account doesn't support message signature"
            );
        },

        /**
         * Sign a given transaction
         */
        async signTransaction() {
            throw new SignTransactionNotSupportedBySmartAccount();
        },

        /**
         * Sign typed data
         */
        async signTypedData() {
            throw new Error(
                "Recovery account doesn't support message signature"
            );
        },

        /**
         * Encode the deployment call data of this account
         */
        async encodeDeployCallData() {
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
            const dummySig =
                "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";
            return concatHex([
                // Mode plugin
                "0x00000001",
                // Dummy content id
                "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
                // Dummy signature
                dummySig,
            ]);
        },
    });

    // Return the smart account, and the context helper methods
    return {
        ...smartAccount,
        setContentContext(contentId) {
            currentContentId = contentId;
        },
        clearContentContext() {
            currentContentId = undefined;
        },
    };
}
