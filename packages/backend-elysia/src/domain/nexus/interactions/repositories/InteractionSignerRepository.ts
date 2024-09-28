import { log } from "@backend-common";
import type { AdminWalletsRepository } from "@backend-common/repositories";
import {
    addresses,
    interactionDelegatorAbi,
    interactionValidatorRoles,
    productInteractionDiamondAbi,
} from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import * as solady from "solady";
import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type LocalAccount,
    type Transport,
    encodeFunctionData,
    keccak256,
} from "viem";
import {
    estimateFeesPerGas,
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

    constructor(
        private readonly client: Client<Transport, Chain>,
        private readonly adminWalletRepository: AdminWalletsRepository
    ) {}

    /**
     * Sign an interaction
     */
    async signInteraction({
        facetData,
        productId,
        user,
        interactionContract,
    }: {
        facetData: Hex;
        user: Address;
        productId: Hex;
        interactionContract: Address;
    }): Promise<Hex | undefined> {
        // Get the signer
        const signerAccount =
            await this.adminWalletRepository.getProductSpecificAccount({
                productId: BigInt(productId),
            });
        // Ensure he is allowed
        const isAllowed = await this.checkIfSignerIsAllowed({
            interactionContract,
            signerAccount,
        });
        if (!isAllowed) {
            return undefined;
        }

        // Get the nonce
        const interactionHash = keccak256(facetData);

        // Build the typed data
        const typedData = {
            domain: {
                name: "Frak.ProductInteraction",
                version: "0.0.1",
                chainId: this.client.chain.id,
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
        return await signTypedData(this.client, {
            account: signerAccount,
            ...typedData,
        });
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

        const isAllowed = await readContract(this.client, {
            abi: productInteractionDiamondAbi,
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
        // Prepare the execution data
        const executeNoBatchData = encodeFunctionData({
            abi: interactionDelegatorAbi,
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

        // The executor that will submit the interactions
        const executorAccount =
            await this.adminWalletRepository.getKeySpecificAccount({
                key: "interaction-executor",
            });

        try {
            // Estimate the gas consumption and price
            const gas = await estimateGas(this.client, {
                account: executorAccount,
                to: addresses.interactionDelegator,
                data: compressedExecute,
            });
            const { maxFeePerGas, maxPriorityFeePerGas } =
                await estimateFeesPerGas(this.client);

            // And send it
            return await sendTransaction(this.client, {
                account: executorAccount,
                to: addresses.interactionDelegator,
                data: compressedExecute,
                // We will provide 50% more gas than the estimation, to ensure proper inclusion
                gas: (gas * 150n) / 100n,
                // We will pay 40% more gas than the estimation, to ensure proper inclusion
                maxFeePerGas: (maxFeePerGas * 140n) / 100n,
                // We will pay 25% more priority fee than the estimation, to ensure proper inclusion
                maxPriorityFeePerGas: (maxPriorityFeePerGas * 125n) / 100n,
            });
        } catch (e) {
            log.error(
                {
                    error: e,
                },
                "Unable to push interactions"
            );
            return undefined;
        }
    }
}
