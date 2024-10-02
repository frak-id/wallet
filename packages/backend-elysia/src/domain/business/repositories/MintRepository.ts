import type { AdminWalletsRepository } from "@backend-common/repositories";
import { addresses, productRegistryAbi } from "@frak-labs/app-essentials";
import { viemClient } from "@frak-labs/nexus-dashboard/src/context/blockchain/provider";
import type { ProductTypesKey } from "@frak-labs/nexus-sdk/core";
import { productTypesMask } from "@frak-labs/nexus-sdk/core";
import { type Address, keccak256, toHex } from "viem";
import {
    readContract,
    simulateContract,
    waitForTransactionReceipt,
    writeContract,
} from "viem/actions";

/**
 * Repository used to mint a product
 */
export class MintRepository {
    constructor(private readonly adminRepository: AdminWalletsRepository) {}

    /**
     * Precompute the product id from a domain
     * @param domain
     */
    precomputeProductId(domain: string) {
        return BigInt(keccak256(toHex(domain)));
    }

    /**
     * Check if the product already exists
     * @param productId
     */
    async isExistingProduct(productId: bigint) {
        try {
            const existingMetadata = await readContract(viemClient, {
                address: addresses.productRegistry,
                abi: productRegistryAbi,
                functionName: "getMetadata",
                args: [productId],
            });
            // Return true if the existing metadata exists
            return existingMetadata.productTypes !== 0n;
        } catch {
            return false;
        }
    }

    /**
     * Mint a new product for the given user
     * @param name
     * @param domain
     * @param productTypes
     * @param owner
     */
    async mintProduct({
        name,
        domain,
        productTypes,
        owner,
    }: {
        name: string;
        domain: string;
        productTypes: ProductTypesKey[];
        owner: Address;
    }) {
        const precomputedProductId = this.precomputeProductId(domain);
        // Ensure the product does not already exist
        {
            const alreadyExist =
                await this.isExistingProduct(precomputedProductId);
            if (alreadyExist) {
                throw new Error(
                    `The product ${name} already exists for the domain ${domain}`
                );
            }
        }

        // Get our minter account
        const minter = await this.adminRepository.getKeySpecificAccount({
            key: "product-minter",
        });
        // Prepare the mint tx and send it
        const simulatedRequest = await simulateContract(viemClient, {
            account: minter,
            address: addresses.productRegistry,
            abi: productRegistryAbi,
            functionName: "mint",
            args: [
                this.encodeProductTypesMask(productTypes),
                name,
                domain,
                owner,
            ],
        });
        if (simulatedRequest.result !== precomputedProductId) {
            throw new Error("Invalid product id");
        }
        const mintTxHash = await writeContract(
            viemClient,
            simulatedRequest.request
        );
        // Wait for the mint to be done before proceeding to the transfer
        await waitForTransactionReceipt(viemClient, {
            hash: mintTxHash,
            confirmations: 1,
        });

        return {
            productId: precomputedProductId,
            mintTxHash,
        };
    }

    /**
     * Encode an array of product types keys into a bit mask
     */
    private encodeProductTypesMask(types: ProductTypesKey[]): bigint {
        return types.reduce((acc, type) => acc | productTypesMask[type], 0n);
    }
}
