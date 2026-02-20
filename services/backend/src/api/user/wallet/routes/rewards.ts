import { sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import type { Address } from "viem";
import { IdentityContext } from "../../../../domain/identity";
import { RewardsContext } from "../../../../domain/rewards/context";
import {
    AssetStatusSchema,
    InteractionTypeSchema,
    RecipientTypeSchema,
} from "../../../../domain/rewards/schemas";
import { WalletContext } from "../../../../domain/wallet";

async function fetchTokenMetadata(
    tokenAddress: Address
): Promise<{ symbol: string; decimals: number; logo?: string }> {
    try {
        const metadata =
            await WalletContext.repositories.balances.getTokenMetadata({
                token: tokenAddress,
            });
        return {
            symbol: metadata.symbol,
            decimals: metadata.decimals,
        };
    } catch {
        return {
            symbol: "UNKNOWN",
            decimals: 18,
        };
    }
}

async function buildTokenMetadataMap(
    assetLogs: Array<{ tokenAddress: Address | null }>
): Promise<Map<string, { symbol: string; decimals: number; logo?: string }>> {
    const uniqueTokens = [
        ...new Set(
            assetLogs
                .map((log) => log.tokenAddress)
                .filter((addr): addr is Address => addr !== null)
        ),
    ];

    const metadataResults = await Promise.all(
        uniqueTokens.map(async (token) => ({
            token,
            metadata: await fetchTokenMetadata(token),
        }))
    );

    return new Map(
        metadataResults.map(({ token, metadata }) => [token, metadata])
    );
}

export const rewardsRoutes = new Elysia({ prefix: "/rewards" })
    .use(sessionContext)
    .get(
        "/history",
        async ({ walletSession }) => {
            const groupIds =
                await IdentityContext.repositories.identity.findAllGroupIdsByWallet(
                    walletSession.address
                );

            if (groupIds.length === 0) {
                return { rewards: [] };
            }

            const assetLogs =
                await RewardsContext.repositories.assetLog.findByIdentityGroups(
                    groupIds
                );

            const tokenMetadataMap = await buildTokenMetadataMap(assetLogs);

            const rewards = assetLogs.map((log) => {
                const tokenMetadata = log.tokenAddress
                    ? tokenMetadataMap.get(log.tokenAddress)
                    : undefined;

                const decimals = tokenMetadata?.decimals ?? 18;
                const amount = Number.parseFloat(log.amount);

                return {
                    id: log.id,
                    amount,
                    tokenAddress: log.tokenAddress ?? undefined,
                    status: log.status,
                    recipientType: log.recipientType,
                    createdAt: log.createdAt,
                    settledAt: log.settledAt ?? undefined,
                    onchainTxHash: log.onchainTxHash ?? undefined,
                    trigger: log.interactionType ?? undefined,
                    merchant: {
                        name: log.merchantName,
                        domain: log.merchantDomain,
                    },
                    token: {
                        symbol: tokenMetadata?.symbol ?? "UNKNOWN",
                        decimals,
                        logo: tokenMetadata?.logo,
                    },
                };
            });

            return { rewards };
        },
        {
            withWalletOrSdkAuthent: true,
            response: {
                401: t.String(),
                200: t.Object({
                    rewards: t.Array(
                        t.Object({
                            id: t.String(),
                            amount: t.Number(),
                            tokenAddress: t.Optional(t.String()),
                            status: AssetStatusSchema,
                            recipientType: RecipientTypeSchema,
                            createdAt: t.Date(),
                            settledAt: t.Optional(t.Date()),
                            onchainTxHash: t.Optional(t.String()),
                            trigger: t.Optional(InteractionTypeSchema),
                            merchant: t.Object({
                                name: t.String(),
                                domain: t.String(),
                            }),
                            token: t.Object({
                                symbol: t.String(),
                                decimals: t.Number(),
                                logo: t.Optional(t.String()),
                            }),
                        })
                    ),
                }),
            },
        }
    );
