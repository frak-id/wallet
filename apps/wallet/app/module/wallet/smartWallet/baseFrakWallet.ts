import { KernelExecuteAbi, kernelAddresses } from "@frak-labs/app-essentials";
import { isSmartAccountDeployed } from "permissionless";
import { getAccountNonce, getSenderAddress } from "permissionless/actions";
import { memo, tryit } from "radash";
import {
    type Address,
    type Chain,
    type Client,
    concatHex,
    encodeFunctionData,
    type Hex,
    hashMessage,
    hashTypedData,
    isAddressEqual,
    slice,
    type Transport,
    toFunctionSelector,
} from "viem";
import {
    entryPoint06Abi,
    entryPoint06Address,
    estimateUserOperationGas,
    getUserOperationHash,
    type SmartAccount,
    type SmartAccountImplementation,
    toSmartAccount,
    type UserOperation,
} from "viem/account-abstraction";
import { formatAbiItem } from "viem/utils";
import type { currentViemClient } from "@/module/blockchain/provider";
import {
    fetchAccountMetadata,
    wrapMessageForSignature,
} from "@/module/wallet/smartWallet/signature";
import { encodeWalletMulticall } from "@/module/wallet/utils/multicall";

export type BaseFrakSmartAccount = SmartAccount<
    SmartAccountImplementation<typeof entryPoint06Abi, "0.6", object, false>
>;

/**
 * Check if the given calldata is already formatted as a call to the wallet
 * @param wallet
 * @param to
 * @param data
 */
function isAlreadyFormattedCall({
    wallet,
    to,
    data,
}: {
    wallet: Address;
    to: Address;
    data: Hex;
}) {
    if (!isAddressEqual(to, wallet)) {
        return false;
    }

    const signature = slice(data, 0, 4);
    return KernelExecuteAbi.some((x) => {
        return (
            x.type === "function" &&
            signature === toFunctionSelector(formatAbiItem(x))
        );
    });
}

/**
 * Check the validity of an existing account address, or fetch the pre-deterministic account address for a kernel smart wallet
 * @param client
 * @param signerPubKey
 * @param initCodeProvider
 */
const getAccountAddress = async <
    TTransport extends Transport = Transport,
    TChain extends Chain = Chain,
>({
    client,
    initCodeProvider,
}: {
    client: Client<TTransport, TChain>;
    initCodeProvider: () => Hex;
}): Promise<Address> => {
    // Find the init code for this account
    const initCode = initCodeProvider();

    // Get the sender address based on the init code
    return getSenderAddress(client, {
        initCode: concatHex([kernelAddresses.factory, initCode]),
        entryPointAddress: entryPoint06Address,
    });
};

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
        stubSignature,
        preDeterminedAccountAddress,
    }: {
        getSignature: (args: { hash: Hex }) => Promise<Hex>;
        stubSignature: Hex;
        generateInitCode: () => Hex;
        preDeterminedAccountAddress?: Address;
    }
): Promise<BaseFrakSmartAccount> {
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
        client: client as Client<TTransport, TChain, undefined>,
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
            // return stub signature encoded as sudo validator
            return concatHex(["0x00000000", stubSignature]);
        },
        userOperation: {
            // Custom override for gas estimation
            async estimateGas(userOperation) {
                if (!userOperation.callData) {
                    return undefined;
                }

                // Do a user operation gas estimation
                const [, userOpEstimation] = await tryit(() =>
                    estimateUserOperationGas(
                        client as unknown as typeof currentViemClient,
                        // @ts-expect-error
                        userOperation as unknown as UserOperation
                    )
                )();
                if (!userOpEstimation) {
                    return undefined;
                }

                // The margin depend on the chain, if testnet x5, if mainnet x1.5
                const margin = client?.chain?.testnet === true ? 500n : 150n;
                // Verification gas margin, 20% on testnet, 5% on mainnet
                const verificationMargin =
                    client?.chain?.testnet === true ? 120n : 105n;
                // Use the estimation with 25% of error margin on the estimation
                return {
                    callGasLimit:
                        (userOpEstimation.callGasLimit * margin) / 100n,
                    preVerificationGas:
                        (userOpEstimation.preVerificationGas * margin) / 100n,
                    verificationGasLimit:
                        (userOpEstimation.verificationGasLimit *
                            verificationMargin) /
                        100n,
                };
            },
        },
    });
}
