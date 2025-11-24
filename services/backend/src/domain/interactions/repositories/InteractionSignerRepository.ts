import {
    adminWalletsRepository,
    interactionDiamondRepository,
    log,
    viemClient,
} from "@backend-infrastructure";
import {
    interactionDelegator_execute,
    productInteractionDiamond_hasAllRoles,
} from "@backend-utils";
import {
    addresses,
    interactionValidatorRoles,
} from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import * as solady from "solady";
import {
    type Address,
    encodeFunctionData,
    type Hex,
    keccak256,
    type LocalAccount,
} from "viem";
import {
    estimateGas,
    readContract,
    sendTransaction,
    signTypedData,
} from "viem/actions";
import type { PreparedInteraction } from "../types/interactions";

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionSignerRepository {
    private signerAllowedCache = new LRUCache<Address, boolean>({
        max: 64,
        // Cache of 10min
        ttl: 10 * 60 * 1000,
    });

    /**
     * Sign an interaction
     */
    async signInteraction({
        facetData,
        productId,
        user,
    }: {
        facetData: Hex;
        user: Address;
        productId: Hex;
    }): Promise<Hex | undefined> {
        // Get the diamond for id
        const interactionContract =
            await interactionDiamondRepository.getDiamondContract(productId);
        if (!interactionContract) {
            log.warn(
                { productId },
                "[InteractionSignerRepository] No diamond contract found for product"
            );
            return undefined;
        }

        // Get the signer
        const signerAccount =
            await adminWalletsRepository.getProductSpecificAccount({
                productId: BigInt(productId),
            });
        // Ensure he is allowed
        const isAllowed = await this.checkIfSignerIsAllowed({
            interactionContract,
            signerAccount,
        });
        if (!isAllowed) {
            log.warn(
                {
                    productId,
                    interactionContract,
                    signer: signerAccount.address,
                },
                "[InteractionSignerRepository] Signer not allowed on product"
            );
            return undefined;
        }

        // Get the nonce
        const interactionHash = keccak256(facetData);

        // Build the typed data
        const typedData = {
            domain: {
                name: "Frak.ProductInteraction",
                version: "0.0.1",
                chainId: viemClient.chain.id,
                verifyingContract: interactionContract,
            },
            types: {
                ValidateInteraction: [
                    { name: "productId", type: "uint256" },
                    { name: "interactionData", type: "bytes32" },
                    { name: "user", type: "address" },
                ],
            },
            primaryType: "ValidateInteraction",
            message: {
                productId: BigInt(productId),
                interactionData: interactionHash,
                user,
            },
        } as const;

        // Sign the typed data
        return await signTypedData(viemClient, {
            account: signerAccount,
            ...typedData,
        });
    }

    /**
     * Check if the signer is allowed for a given product
     * @param productId
     */
    async checkSignerAllowedForProduct(
        productId: Hex
    ): Promise<{ isAllowed: boolean; signerAddress?: Address }> {
        // Get the diamond for id
        const interactionContract =
            await interactionDiamondRepository.getDiamondContract(productId);
        if (!interactionContract) {
            log.warn(
                { productId },
                "[InteractionSignerRepository] No diamond contract found for product"
            );
            return { isAllowed: false };
        }

        // Get the signer
        const signerAccount =
            await adminWalletsRepository.getProductSpecificAccount({
                productId: BigInt(productId),
            });

        // Check if allowed (with cache)
        const isAllowed = await this.checkIfSignerIsAllowed({
            interactionContract,
            signerAccount,
        });

        return {
            isAllowed,
            signerAddress: signerAccount.address,
        };
    }

    /**
     * Check if the signer is allowed to sign the interaction
     * @param interactionContract
     * @param signerAccount
     * @private
     */
    private async checkIfSignerIsAllowed({
        interactionContract,
        signerAccount,
    }: {
        interactionContract: Address;
        signerAccount: LocalAccount;
    }) {
        const cached = this.signerAllowedCache.get(signerAccount.address);
        if (cached !== undefined) {
            return cached;
        }

        const isAllowed = await readContract(viemClient, {
            abi: [productInteractionDiamond_hasAllRoles],
            address: interactionContract,
            functionName: "hasAllRoles",
            args: [signerAccount.address, interactionValidatorRoles],
        });
        this.signerAllowedCache.set(signerAccount.address, isAllowed);
        return isAllowed;
    }

    /**
     * Push prepared interactions to the blockchain
     * @param preparedInteractions
     */
    async pushPreparedInteractions(
        preparedInteractions: PreparedInteraction[]
    ) {
        // The executor that will submit the interactions
        const executorAccount =
            await adminWalletsRepository.getKeySpecificAccount({
                key: "interaction-executor",
            });

        // Prepare the execution data
        const executeNoBatchData = encodeFunctionData({
            abi: [interactionDelegator_execute],
            functionName: "execute",
            args: [
                preparedInteractions.map(
                    ({ interaction, packedInteraction }) => ({
                        wallet: interaction.wallet,
                        interaction: {
                            productId: BigInt(interaction.productId),
                            data: packedInteraction,
                        },
                    })
                ),
            ],
        });

        // Compress it
        const compressedExecute = solady.LibZip.cdCompress(
            executeNoBatchData
        ) as Hex;

        try {
            // Get the most efficient call to be done
            const { data, gas } = await this.getMoreEfficientCall({
                compressedData: compressedExecute,
                initialData: executeNoBatchData,
                account: executorAccount,
            });

            // Log it
            log.debug(
                {
                    original: executeNoBatchData.length,
                    compressed: compressedExecute.length,
                    gas,
                },
                "[InteractionSignerRepository] Data sizes for interactions execution"
            );

            // And send it
            return await sendTransaction(viemClient, {
                account: executorAccount,
                to: addresses.interactionDelegator,
                data,
                // Provide a 25% more gas than the estimation (in the case of campaign deployed in-between)
                gas: (gas * 125n) / 100n,
            });
        } catch (error) {
            log.error(
                {
                    error,
                },
                "[InteractionSignerRepository] Unable to push interactions"
            );
            return undefined;
        }
    }

    /**
     * Find the most efficient call to submit interaction
     * @returns
     */
    private async getMoreEfficientCall({
        compressedData,
        initialData,
        account,
    }: {
        compressedData: Hex;
        initialData: Hex;
        account: LocalAccount;
    }) {
        // Perform both simulation
        const [compressedGas, initialGas] = await Promise.all([
            estimateGas(viemClient, {
                account,
                to: addresses.interactionDelegator,
                data: compressedData,
            }),
            estimateGas(viemClient, {
                account,
                to: addresses.interactionDelegator,
                data: initialData,
            }),
        ]);

        // Determine the data to use (most efficient one, or compressed one if initial is more than 8kb)
        if (compressedGas > initialGas && initialData.length < 8192) {
            return { data: initialData, gas: initialGas };
        }

        return { data: compressedData, gas: compressedGas };
    }
}
