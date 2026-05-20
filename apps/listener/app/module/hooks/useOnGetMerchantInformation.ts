import type {
    GetMerchantInformationReturnType,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
} from "@frak-labs/frame-connector";
import { estimatedRewardsQueryOptions } from "@frak-labs/wallet-shared/common/hook/useEstimatedReward";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { WalletRpcContext } from "@/module/types/context";
import { ensureHydrated, queryClient } from "@/queryClient";

type OnGetMerchantInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMerchantInformation",
    WalletRpcContext
>;

export function createGetMerchantInformationHandler(): OnGetMerchantInformation {
    return async (_params, context) => {
        // Wait for sessionStorage hydration so cached entries from previous
        // page loads are available before falling back to a network round-trip.
        await ensureHydrated();
        const { merchantId } = context;

        if (!merchantId) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "The current merchant doesn't exist within the Frak ecosystem"
            );
        }

        const domain = new URL(context.sourceUrl).host.replace("www.", "");
        const backendConfig = resolvingContextStore.getState().backendSdkConfig;

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
    };
}
