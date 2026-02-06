import type {
    EstimatedReward,
    GetMerchantInformationReturnType,
    IFrameRpcSchema,
    InteractionTypeKey,
} from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import type { Address } from "viem";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetMerchantInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMerchantInformation",
    WalletRpcContext
>;

export function useOnGetMerchantInformation(): OnGetMerchantInformation {
    return useCallback(async (_params, context) => {
        const { merchantId } = context;

        if (!merchantId) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "The current merchant doesn't exist within the Frak ecosystem"
            );
        }

        const domain = new URL(context.sourceUrl).host.replace("www.", "");

        const [resolveResult, rewardsResult] = await Promise.all([
            authenticatedBackendApi.user.merchant.resolve.get({
                query: { domain },
            }),
            authenticatedBackendApi.user.merchant["estimated-rewards"].get({
                query: { merchantId },
            }),
        ]);

        if (resolveResult.error || !resolveResult.data) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "The current merchant doesn't exist within the Frak ecosystem"
            );
        }

        return {
            id: resolveResult.data.merchantId,
            onChainMetadata: {
                name: resolveResult.data.name ?? "",
                domain,
            },
            rewards: (rewardsResult.data?.rewards ?? []).map((reward) => ({
                token: reward.token as Address | undefined,
                campaignId: reward.campaignId,
                interactionTypeKey:
                    reward.interactionTypeKey as InteractionTypeKey,
                referrer: reward.referrer as EstimatedReward | undefined,
                referee: reward.referee as EstimatedReward | undefined,
            })),
        } satisfies GetMerchantInformationReturnType;
    }, []);
}
