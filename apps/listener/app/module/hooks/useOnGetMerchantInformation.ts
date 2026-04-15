import type {
    GetMerchantInformationReturnType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { estimatedRewardsQueryOptions } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetMerchantInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMerchantInformation",
    WalletRpcContext
>;

export function useOnGetMerchantInformation(): OnGetMerchantInformation {
    const queryClient = useQueryClient();
    const backendConfig = resolvingContextStore((s) => s.backendSdkConfig);

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

            const rewards = await queryClient.fetchQuery(
                estimatedRewardsQueryOptions(merchantId)
            );

            return {
                id: merchantId,
                onChainMetadata: {
                    name: backendConfig?.name ?? "",
                    domain,
                },
                rewards: rewards as GetMerchantInformationReturnType["rewards"],
            } satisfies GetMerchantInformationReturnType;
        },
        [queryClient, backendConfig]
    );
}
