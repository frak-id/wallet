import { log, viemClient } from "@backend-common";
import { interactionManager_getInteractionContract } from "@backend-utils";
import { addresses } from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import type { Address, Hex } from "viem";
import { readContract } from "viem/actions";

/**
 * The interaction diamonds repositories
 *  - Used to fetch contract address for a given product
 *  - Used to simulate transaction
 */
export class InteractionDiamondRepository {
    private addressCache = new LRUCache<string, { address?: Address }>({
        max: 256,
        // TTL of 10min
        ttl: 10 * 60 * 1000,
    });

    /**
     * Get the diamond address for a given product
     * @param productId
     */
    async getDiamondContract(productId: Hex): Promise<Address | undefined> {
        const cached = this.addressCache.get(productId);
        if (cached) {
            return cached.address;
        }

        try {
            const address = await readContract(viemClient, {
                address: addresses.productInteractionManager,
                abi: [interactionManager_getInteractionContract],
                functionName: "getInteractionContract",
                args: [BigInt(productId)],
            });
            this.addressCache.set(productId, { address });
            return address;
        } catch (error) {
            log.error(
                {
                    productId,
                    error,
                },
                "Failed to get diamond contract"
            );
            this.addressCache.set(productId, { address: undefined });
        }
        return undefined;
    }
}

export const interactionDiamondRepository = new InteractionDiamondRepository();
