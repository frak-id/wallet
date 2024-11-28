import { log } from "@backend-common";
import {
    addresses,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import type { Address, Client, Hex } from "viem";
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

    constructor(private readonly client: Client) {}

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
            const address = await readContract(this.client, {
                address: addresses.productInteractionManager,
                abi: productInteractionManagerAbi,
                functionName: "getInteractionContract",
                args: [BigInt(productId)],
            });
            this.addressCache.set(productId, { address });
            return address;
        } catch (e) {
            log.error(
                {
                    productId,
                    error: e,
                },
                "Failed to get diamond contract"
            );
            this.addressCache.set(productId, { address: undefined });
        }
        return undefined;
    }
}
