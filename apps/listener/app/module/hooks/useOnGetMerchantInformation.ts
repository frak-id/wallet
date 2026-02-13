import type {
    GetMerchantInformationReturnType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { estimatedRewardsQueryOptions } from "@/module/hooks/useEstimatedRewards";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetMerchantInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMerchantInformation",
    WalletRpcContext
>;

export function useOnGetMerchantInformation(): OnGetMerchantInformation {
    const queryClient = useQueryClient();

    return useCallback(
        async (_params, context) => {
            const { merchantId } = context;

            if (!merchantId) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "The current merchant doesn't exist within the Frak ecosystem"
                );
            }

            const domain = new URL(context.sourceUrl).host.replace("www.", "");

            const [resolveResult, rewards] = await Promise.all([
                authenticatedBackendApi.user.merchant.resolve.get({
                    query: { domain },
                }),
                queryClient.fetchQuery(
                    estimatedRewardsQueryOptions(merchantId)
                ),
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
                rewards,
            } satisfies GetMerchantInformationReturnType;
        },
        [queryClient]
    );
}
