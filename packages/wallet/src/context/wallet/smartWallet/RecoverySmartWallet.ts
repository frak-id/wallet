import { kernelAddresses } from "@/context/common/blockchain/addresses";
import { KernelExecuteAbi } from "@/context/wallet/abi/KernelAccountAbi";
import { getAccountInitCode } from "@/context/wallet/smartWallet/NexusSmartWallet";
import type { WebAuthNWallet } from "@/types/WebAuthN";
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
    type LocalAccount,
    type Transport,
    concatHex,
    encodeFunctionData,
    keccak256,
    toHex,
} from "viem";
import { signMessage } from "viem/actions";

export type NexusRecoverySmartAccount<
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<
    ENTRYPOINT_ADDRESS_V06_TYPE,
    "nexusRecoverySmartAccount",
    transport,
    chain
>;

/**
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
 * @param client
 * @param localAccount
 * @param deployedAccountAddress
 */
export function recoverySmartAccount<
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>(
    client: Client<TTransport, TChain>,
    {
        localAccount,
        initialWallet,
        accountAddress,
    }: {
        localAccount: LocalAccount;
        initialWallet: WebAuthNWallet;
        accountAddress: Address;
    }
): NexusRecoverySmartAccount<TTransport, TChain> {
    if (!accountAddress) throw new Error("Account address not found");

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

    // Build the smart account itself
    return toSmartAccount({
        address: accountAddress,

        client: client,
        entryPoint: ENTRYPOINT_ADDRESS_V06,
        source: "nexusRecoverySmartAccount",

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
            return kernelAddresses.factory;
        },

        /**
         * Get the smart account factory data
         */
        async getFactoryData() {
            if (await isKernelAccountDeployed()) return undefined;
            return getAccountInitCode({
                authenticatorIdHash: keccak256(
                    toHex(initialWallet.authenticatorId)
                ),
                signerPubKey: initialWallet.publicKey,
            });
        },

        /**
         * Generate the account init code
         */
        async getInitCode() {
            if (await isKernelAccountDeployed()) return "0x";
            const initCode = getAccountInitCode({
                authenticatorIdHash: keccak256(
                    toHex(initialWallet.authenticatorId)
                ),
                signerPubKey: initialWallet.publicKey,
            });
            return concatHex([kernelAddresses.factory, initCode]);
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
            const signature = await signMessage(client, {
                account: localAccount,
                message: { raw: hash },
            });

            // Use it as a plugin, since should be enabled during recovery phase
            return concatHex(["0x00000001", signature]);
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
            return concatHex(["0x00000001", dummySig]);
        },
    });
}
