import type { currentViemClient } from "@/module/blockchain/provider";
import type { SmartAccountV06 } from "@/module/wallet/smartWallet/utils";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { KernelWallet, kernelAddresses } from "@frak-labs/app-essentials";
import { isSmartAccountDeployed } from "permissionless";
import { getAccountNonce } from "permissionless/actions";
import { memo, tryit } from "radash";
import {
    type Chain,
    type Client,
    type Hex,
    type LocalAccount,
    type Transport,
    concatHex,
    isAddressEqual,
    keccak256,
    toHex,
} from "viem";
import {
    entryPoint06Abi,
    entryPoint06Address,
    getUserOperationHash,
    toSmartAccount,
} from "viem/account-abstraction";
import { estimateGas, signMessage } from "viem/actions";

export type NexusRecoverySmartAccount = SmartAccountV06;

/**
 * Build a kernel smart account from a private key, that use the ECDSA signer behind the scene
 * @param client
 * @param localAccount
 * @param deployedAccountAddress
 */
export function recoverySmartAccount<
    TAccountSource extends string,
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        localAccount,
        initialWallet,
    }: {
        localAccount: LocalAccount<TAccountSource>;
        initialWallet: WebAuthNWallet;
    }
): Promise<NexusRecoverySmartAccount> {
    if (!initialWallet?.address) throw new Error("Account address not found");

    // Helper to check if the smart account is already deployed (with caching)
    const isKernelAccountDeployed = memo(
        async () => {
            return await isSmartAccountDeployed(client, initialWallet.address);
        },
        { key: () => `${initialWallet.address}-id-deployed` }
    );

    // Build the smart account itself
    return toSmartAccount({
        client,
        entryPoint: {
            version: "0.6",
            abi: entryPoint06Abi,
            address: entryPoint06Address,
        },
        // Account address
        getAddress: async () => initialWallet.address,
        // Get nonce
        async getNonce() {
            return getAccountNonce(client, {
                address: await this.getAddress(),
                entryPointAddress: entryPoint06Address,
            });
        },
        // Factory args
        async getFactoryArgs() {
            if (await isKernelAccountDeployed()) {
                return { factory: undefined, factoryData: undefined };
            }
            return {
                factory: kernelAddresses.factory,
                factoryData: KernelWallet.getWebAuthNSmartWalletInitCode({
                    authenticatorIdHash: keccak256(
                        toHex(initialWallet.authenticatorId)
                    ),
                    signerPubKey: initialWallet.publicKey,
                }),
            };
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
        async signUserOperation(userOperation) {
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    sender: userOperation.sender ?? initialWallet.address,
                    signature: "0x",
                },
                entryPointAddress: entryPoint06Address,
                entryPointVersion: "0.6",
                chainId: client.chain.id,
            });
            const signature = await signMessage(client, {
                account: localAccount,
                message: { raw: hash },
            });

            // Use it as a plugin, since should be enabled during recovery phase
            return concatHex(["0x00000001", signature]);
        },
        // Encode call data
        async encodeCalls(calls) {
            if (calls.length > 1) {
                throw new Error(
                    "Recovery account doesn't support batched transactions"
                );
            }
            const call = calls[0];
            if (!isAddressEqual(call.to, initialWallet.address)) {
                throw new Error(
                    "Recovery account doesn't support transactions to other addresses"
                );
            }

            return call.data ?? "0x";
        },
        // Dummy sig
        async getStubSignature() {
            const dummySig =
                "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";
            return concatHex(["0x00000001", dummySig]);
        },
        // Signature disables for recovery account
        async signMessage() {
            throw new Error(
                "Recovery account doesn't support message signature"
            );
        },
        async signTypedData() {
            throw new Error(
                "Recovery account doesn't support message signature"
            );
        },
        userOperation: {
            // Custom override for gas estimation
            async estimateGas(userOperation) {
                if (!userOperation.callData) {
                    return undefined;
                }

                const [, estimation] = await tryit(() =>
                    estimateGas(client as unknown as typeof currentViemClient, {
                        account: userOperation.sender ?? initialWallet.address,
                        to: userOperation.sender ?? initialWallet.address,
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
