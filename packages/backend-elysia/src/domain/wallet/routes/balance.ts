import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import type { GetRewardResponseDto } from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { sift } from "radash";
import { formatUnits, isAddressEqual, toHex } from "viem";
import { walletContext } from "../context";

export const balanceRoutes = new Elysia({ prefix: "/balance" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "",
        async ({
            pricingRepository,
            balancesRepository,
            walletSession,
            error,
        }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Get all the user balances
            const balances = await balancesRepository.getUserBalance({
                address: walletSession.address,
            });

            // For each balances, get the eur price
            const mappedBalances = sift(
                await Promise.all(
                    balances.map(async (tokenBalance) => {
                        // Get the eur price of the token
                        const price = await pricingRepository.getTokenPrice({
                            token: tokenBalance.contractAddress,
                        });
                        if (!price) return null;

                        // Return the well formatted balance
                        return {
                            token: tokenBalance.contractAddress,
                            name: tokenBalance.metadata.name,
                            symbol: tokenBalance.metadata.symbol,
                            decimals: tokenBalance.metadata.decimals,
                            rawBalance: toHex(tokenBalance.rawBalance),
                            // Formatted amount
                            amount: tokenBalance.balance,
                            eurAmount: tokenBalance.balance * price.eur,
                            usdAmount: tokenBalance.balance * price.usd,
                            gbpAmount: tokenBalance.balance * price.gbp,
                        };
                    })
                )
            );

            // Get the total balance
            const totalBalance = mappedBalances.reduce(
                (acc, { amount, eurAmount, usdAmount, gbpAmount }) => ({
                    amount: acc.amount + amount,
                    eurAmount: acc.eurAmount + eurAmount,
                    usdAmount: acc.usdAmount + usdAmount,
                    gbpAmount: acc.gbpAmount + gbpAmount,
                }),
                { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 }
            );

            return {
                total: totalBalance,
                balances: mappedBalances,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    // Total
                    total: t.TokenAmount(),
                    // Details about the balances
                    balances: t.Array(
                        t.Union([
                            t.TokenAmount(),
                            t.Object({
                                token: t.Address(),
                                name: t.String(),
                                symbol: t.String(),
                                decimals: t.Number(),
                                rawBalance: t.Hex(),
                            }),
                        ])
                    ),
                }),
            },
        }
    )
    .get(
        "/claimable",
        async ({ indexerApi, pricingRepository, walletSession, error }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Fetch the pending rewards for this user
            const { rewards, tokens } = await indexerApi
                .get(`rewards/${walletSession.address}`)
                .json<GetRewardResponseDto>();
            if (!rewards.length) {
                return {
                    total: {
                        amount: 0,
                        eurAmount: 0,
                        usdAmount: 0,
                        gbpAmount: 0,
                    },
                    claimables: [],
                };
            }

            const claimablesAsync = rewards
                // Filter out potential negative reward (in case of indexer bug)
                .filter((reward) => BigInt(reward.amount) > 0n)
                // Map rewards with tokens and eur price
                .map(async (reward) => {
                    const token = tokens.find((token) =>
                        isAddressEqual(token.address, reward.token)
                    );
                    if (!token) return null;

                    // Get the eur price of the token
                    const price = await pricingRepository.getTokenPrice({
                        token: reward.token,
                    });
                    if (!price) return null;

                    const rawBalance = BigInt(reward.amount);
                    const balance = Number.parseFloat(
                        formatUnits(rawBalance, token.decimals)
                    );

                    return {
                        // Basic info
                        contract: reward.address,
                        token: reward.token,
                        name: token.name,
                        symbol: token.symbol,
                        decimals: token.decimals,
                        rawBalance: toHex(rawBalance),
                        // Formatted amount
                        amount: balance,
                        eurAmount: balance * price.eur,
                        usdAmount: balance * price.usd,
                        gbpAmount: balance * price.gbp,
                    };
                });
            const claimables = sift(await Promise.all(claimablesAsync));

            // Get the total claimable
            const totalClaimable = claimables.reduce(
                (acc, { amount, eurAmount, usdAmount, gbpAmount }) => ({
                    amount: acc.amount + amount,
                    eurAmount: acc.eurAmount + eurAmount,
                    usdAmount: acc.usdAmount + usdAmount,
                    gbpAmount: acc.gbpAmount + gbpAmount,
                }),
                { amount: 0, eurAmount: 0, usdAmount: 0, gbpAmount: 0 }
            );

            return {
                total: totalClaimable,
                claimables,
            };
        },
        {
            authenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    // Total claimable
                    total: t.TokenAmount(),
                    // Details about the claimable rewards
                    claimables: t.Array(
                        t.Union([
                            t.TokenAmount(),
                            t.Object({
                                contract: t.Address(),
                                token: t.Address(),
                                name: t.String(),
                                symbol: t.String(),
                                decimals: t.Number(),
                                rawBalance: t.Hex(),
                            }),
                        ])
                    ),
                }),
            },
        }
    );
