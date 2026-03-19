import {
    type TokenMetadata,
    tokenMetadataRepository,
    viemClient,
} from "@backend-infrastructure";
import { currentStablecoinsList } from "@frak-labs/app-essentials";
import { type Address, erc20Abi, formatUnits } from "viem";
import { multicall } from "viem/actions";

export class BalancesRepository {
    /**
     * Get the user balance
     * @param address
     */
    async getUserBalance({ address }: { address: Address }) {
        // Get the user balance on every known tokens
        const userBalances = await this.getUserBalanceViaKnownTokens({
            address,
        });

        // Get the effective balance, where asset are gt than 0
        const effectiveBalances = userBalances.filter(
            ({ tokenBalance }) => tokenBalance > 0n
        );

        // Then map them with the associated metadatas
        return await Promise.all(
            effectiveBalances.map(async ({ contractAddress, tokenBalance }) => {
                const metadata = await this.getTokenMetadata({
                    token: contractAddress,
                });
                return {
                    contractAddress,
                    metadata,
                    rawBalance: tokenBalance,
                    balance: Number.parseFloat(
                        formatUnits(tokenBalance, metadata.decimals)
                    ),
                };
            })
        );
    }

    /**
     * Get the user balance around every known tokens
     */
    async getUserBalanceViaKnownTokens({ address }: { address: Address }) {
        // Fetch every balance in a single multicall
        const balanceResults = await multicall(viemClient, {
            contracts: currentStablecoinsList.map(
                (token) =>
                    ({
                        abi: erc20Abi,
                        address: token,
                        functionName: "balanceOf",
                        args: [address],
                    }) as const
            ),
        });

        // Map the results to the known tokens
        const userBalances = balanceResults.map(({ result, error }, index) => {
            if (error) {
                return {
                    contractAddress: currentStablecoinsList[index],
                    tokenBalance: 0n,
                };
            }

            return {
                contractAddress: currentStablecoinsList[index],
                tokenBalance: result,
            };
        });

        return userBalances;
    }

    /**
     * Get a token metadata
     * @param token
     */
    async getTokenMetadata({
        token,
    }: {
        token: Address;
    }): Promise<TokenMetadata> {
        return tokenMetadataRepository.getMetadata({ token });
    }

    async getTokenMetadataBatch(
        tokens: Address[]
    ): Promise<Map<Address, TokenMetadata>> {
        return tokenMetadataRepository.getMetadataBatch(tokens);
    }
}
