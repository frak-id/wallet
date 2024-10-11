import {
    blockchainContext,
    indexerApiContext,
    nextSessionContext,
} from "@backend-common";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { toHex } from "viem";
import { BalancesRepository } from "../repositories/BalancesRepository";
import { PricingRepository } from "../repositories/PricingRepository";

export const balanceRoutes = new Elysia({ prefix: "/balance" })
    .use(nextSessionContext)
    .use(indexerApiContext)
    .use(blockchainContext)
    .decorate(({ client, ...decorators }) => ({
        ...decorators,
        balancesRepository: new BalancesRepository(client),
        pricingRepository: new PricingRepository(),
    }))
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
                address: walletSession.wallet.address,
            });

            // For each balances, get the eur price
            const mappedBalances = await Promise.all(
                balances.map(async (tokenBalance) => {
                    // Get the eur price of the token
                    const { eur } = await pricingRepository.getTokenPrice({
                        token: tokenBalance.contractAddress,
                    });

                    // Return the well formatted balance
                    return {
                        token: tokenBalance.contractAddress,
                        name: tokenBalance.metadata.name,
                        symbol: tokenBalance.metadata.symbol,
                        decimal: tokenBalance.metadata.decimals,
                        balance: tokenBalance.balance,
                        eurBalance: tokenBalance.balance * eur,
                        rawBalance: toHex(tokenBalance.rawBalance),
                    };
                })
            );

            // Get the total eur balance
            const eurBalance = mappedBalances.reduce(
                (acc, { eurBalance }) => acc + eurBalance,
                0
            );

            return {
                eurBalance: eurBalance,
                balances: mappedBalances,
                eurClaimable: 0,
                claimables: [],
            };
        },
        {
            isAuthenticated: "wallet",
            response: {
                401: t.String(),
                200: t.Object({
                    eurBalance: t.Number(),
                    balances: t.Array(
                        t.Object({
                            token: t.Address(),
                            name: t.String(),
                            symbol: t.String(),
                            decimal: t.Number(),
                            balance: t.Number(),
                            eurBalance: t.Number(),
                            rawBalance: t.Hex(),
                        })
                    ),
                    eurClaimable: t.Number(),
                    claimables: t.Array(
                        t.Object({
                            token: t.Address(),
                            name: t.String(),
                            symbol: t.String(),
                            decimal: t.Number(),
                            balance: t.Number(),
                            rawBalance: t.Hex(),
                        })
                    ),
                }),
            },
        }
    );
