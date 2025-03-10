import type { currentViemClient } from "@/module/blockchain/provider";
import {
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/module/wallet/smartWallet/signature";
import {
    type SmartAccountV06,
    getAccountAddress,
    isAlreadyFormattedCall,
} from "@/module/wallet/smartWallet/utils";
import { encodeWalletMulticall } from "@/module/wallet/utils/multicall";
import { KernelExecuteAbi } from "@frak-labs/app-essentials";
import { kernelAddresses } from "@frak-labs/app-essentials";
import { isSmartAccountDeployed } from "permissionless";
import { getAccountNonce } from "permissionless/actions";
import { memo, tryit } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type Transport,
    concatHex,
    encodeFunctionData,
    hashMessage,
    hashTypedData,
    isAddressEqual,
} from "viem";
import {
    entryPoint06Abi,
    entryPoint06Address,
    getUserOperationHash,
    toSmartAccount,
} from "viem/account-abstraction";
import { estimateGas } from "viem/actions";

export type FrakWebAuthNWallet = SmartAccountV06;

/**
 * Build a base kernel account for Frak
 * @param client
 * @param authenticatorId
 */
export async function baseFrakWallet<
    TTransport extends Transport,
    TChain extends Chain,
>(
    client: Client<TTransport, TChain>,
    {
        getSignature,
        generateInitCode,
        getStubSignature,
        preDeterminedAccountAddress,
    }: {
        getSignature: (args: { hash: Hex }) => Promise<Hex>;
        getStubSignature: () => Hex;
        generateInitCode: () => Hex;
        preDeterminedAccountAddress?: Address;
    }
): Promise<FrakWebAuthNWallet> {
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
            return getSignature({ hash: challenge });
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
            return getSignature({ hash: challenge });
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
            return getSignature({ hash: challenge });
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
            const encodedSignature = await getSignature({ hash });

            // Always use the sudo mode, since we are starting from the postula that this p256 signer is the default one for the smart account
            return concatHex(["0x00000000", encodedSignature]);
        },
        // Get dummy sig
        async getStubSignature() {
            const stub = getStubSignature();
            // return the coded signature
            return concatHex(["0x00000000", stub]);
        },
        userOperation: {
            // Custom override for gas estimation
            async estimateGas(userOperation) {
                if (!userOperation.callData) {
                    return undefined;
                }

                const [, estimation] = await tryit(() =>
                    estimateGas(client as unknown as typeof currentViemClient, {
                        account: userOperation.sender ?? accountAddress,
                        to: userOperation.sender ?? accountAddress,
                        data: userOperation.callData as Hex,
                    })
                )();
                if (!estimation) {
                    return undefined;
                }
                // The margin depend on the chain, if testnet x10, if mainnet x1.25
                const margin = client?.chain?.testnet === true ? 1000n : 125n;
                // Use the estimation with 25% of error margin on the estimation
                return {
                    callGasLimit: (estimation * margin) / 100n,
                };
            },
        },
    });
}
