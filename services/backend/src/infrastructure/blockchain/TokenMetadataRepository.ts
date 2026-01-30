import { viemClient } from "@backend-infrastructure";
import { LRUCache } from "lru-cache";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";

export type TokenMetadata = {
    name: string;
    symbol: string;
    decimals: number;
};

export class TokenMetadataRepository {
    private readonly cache = new LRUCache<Address, TokenMetadata>({
        max: 128,
    });

    /**
     * Get the decimals for a token
     */
    async getDecimals({ token }: { token: Address }): Promise<number> {
        const metadata = await this.getMetadata({ token });
        return metadata.decimals;
    }

    /**
     * Get the full metadata for a token (name, symbol, decimals)
     */
    async getMetadata({ token }: { token: Address }): Promise<TokenMetadata> {
        const cached = this.cache.get(token);
        if (cached) {
            return cached;
        }

        const rawMetadata = await multicall(viemClient, {
            contracts: [
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "symbol",
                },
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "name",
                },
                {
                    abi: erc20Abi,
                    address: token,
                    functionName: "decimals",
                },
            ] as const,
            allowFailure: false,
        });
        const metadata: TokenMetadata = {
            symbol: rawMetadata[0],
            name: rawMetadata[1],
            decimals: rawMetadata[2],
        };

        this.cache.set(token, metadata);
        return metadata;
    }
}

export const tokenMetadataRepository = new TokenMetadataRepository();
