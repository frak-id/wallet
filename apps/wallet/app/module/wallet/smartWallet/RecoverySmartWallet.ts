import type {
    BaseFrakSmartAccount,
    currentViemClient,
} from "@frak-labs/wallet-shared";
import { isSmartAccountDeployed } from "permissionless";
import { getAccountNonce } from "permissionless/actions";
import { memo, tryit } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    concatHex,
    type Hex,
    isAddressEqual,
    type LocalAccount,
    type Transport,
} from "viem";
import {
    entryPoint06Abi,
    entryPoint06Address,
    getUserOperationHash,
    toSmartAccount,
} from "viem/account-abstraction";
import { estimateGas, signMessage } from "viem/actions";

/**
 * Build a kernel smart account that signs with the recovery guardian ECDSA
 * key. Used to push the `doAddPasskey` recovery transaction onto an existing
 * (already deployed) wallet.
 *
 * Recovery only ever targets a deployed wallet — the recovery execution is
 * configured on-chain via `setExecution`, which requires deployment — so this
 * account never needs factory init code, only the wallet address + guardian.
 */
export function recoverySmartAccount<
    TAccountSource extends string,
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        localAccount,
        walletAddress,
    }: {
        localAccount: LocalAccount<TAccountSource>;
        walletAddress: Address;
    }
): Promise<BaseFrakSmartAccount> {
    if (!walletAddress) throw new Error("Account address not found");

    // Helper to check if the smart account is already deployed (with caching)
    const isKernelAccountDeployed = memo(
        async () => {
            return await isSmartAccountDeployed(client, walletAddress);
        },
        { key: () => `${walletAddress}-id-deployed` }
    );

    // Build the smart account itself
    return toSmartAccount({
        client: client as Client<TTransport, TChain, undefined>,
        entryPoint: {
            version: "0.6",
            abi: entryPoint06Abi,
            address: entryPoint06Address,
        },
        // Account address
        getAddress: async () => walletAddress,
        // Get nonce
        async getNonce() {
            return getAccountNonce(client, {
                address: await this.getAddress(),
                entryPointAddress: entryPoint06Address,
            });
        },
        // Factory args — recovery only acts on a deployed wallet, so the
        // account must already exist on-chain.
        async getFactoryArgs() {
            if (await isKernelAccountDeployed()) {
                return { factory: undefined, factoryData: undefined };
            }
            throw new Error(
                "Cannot recover a wallet that is not deployed on-chain"
            );
        },

        /**
         * Let the smart account sign the given userOperation
         * @param userOperation
         */
        async signUserOperation(userOperation) {
            const hash = getUserOperationHash({
                userOperation: {
                    ...userOperation,
                    sender: userOperation.sender ?? walletAddress,
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
            if (!isAddressEqual(call.to, walletAddress)) {
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
                        account: userOperation.sender ?? walletAddress,
                        to: userOperation.sender ?? walletAddress,
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
