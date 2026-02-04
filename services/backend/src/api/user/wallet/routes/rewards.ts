import { JwtContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { IdentityContext } from "../../../../domain/identity";
import { RewardsContext } from "../../../../domain/rewards/context";
import {
    AssetStatusSchema,
    InteractionTypeSchema,
    RecipientTypeSchema,
} from "../../../../domain/rewards/schemas";
import { WalletContext } from "../../../../domain/wallet";

async function resolveIdentityGroupId(
    walletAuth: string | undefined,
    walletSdkAuth: string | undefined
): Promise<string | undefined> {
    let walletAddress: Address | undefined;

    if (walletAuth) {
        const session = await JwtContext.wallet.verify(walletAuth);
        if (
            session &&
            typeof session === "object" &&
            "address" in session &&
            typeof session.address === "string"
        ) {
            walletAddress = session.address;
        }
    }

    if (!walletAddress && walletSdkAuth) {
        const session = await JwtContext.walletSdk.verify(walletSdkAuth);
        if (
            session &&
            typeof session === "object" &&
            "address" in session &&
            typeof session.address === "string"
        ) {
            walletAddress = session.address;
        }
    }

    if (!walletAddress) {
        return undefined;
    }

    const group =
        await IdentityContext.repositories.identity.findGroupByIdentity({
            type: "wallet",
            value: walletAddress,
        });

    return group?.id;
}

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

export const rewardsRoutes = new Elysia({ prefix: "/rewards" }).get(
    "/history",
    async ({ headers }) => {
        const identityGroupId = await resolveIdentityGroupId(
            headers["x-wallet-auth"],
            headers["x-wallet-sdk-auth"]
        );

        if (!identityGroupId) {
            return { rewards: [] };
        }

        const assetLogs =
            await RewardsContext.repositories.assetLog.findByIdentityGroup(
                identityGroupId
            );

        const tokenMetadataMap = await buildTokenMetadataMap(assetLogs);

        const rewards = assetLogs.map((log) => {
            const tokenMetadata = log.tokenAddress
                ? tokenMetadataMap.get(log.tokenAddress)
                : undefined;

            const decimals = tokenMetadata?.decimals ?? 18;
            const amount = Number.parseFloat(
                formatUnits(BigInt(log.amount), decimals)
            );

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
        headers: t.Object({
            "x-wallet-auth": t.Optional(t.String()),
            "x-wallet-sdk-auth": t.Optional(t.String()),
        }),
        response: {
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
