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
import { useCallback } from "react";
import type { Hex } from "viem";
import type { WalletRpcContext } from "@/module/types/context";

type OnGetMerchantInformation = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_getMerchantInformation",
    WalletRpcContext
>;

/**
 * Get the current merchant information from the backend
 *
 * Note: Context is augmented by middleware with merchantId, sourceUrl, etc.
 */
export function useOnGetMerchantInformation(): OnGetMerchantInformation {
    return useCallback(async (_params, context) => {
        const { merchantId } = context;

        if (!merchantId) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "The current merchant doesn't exist within the Frak ecosystem"
            );
        }

        const { data, error } =
            await authenticatedBackendApi.user.merchant.resolve.get({
                query: {
                    domain: new URL(context.sourceUrl).host.replace("www.", ""),
                },
            });

        if (error || !data) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "The current merchant doesn't exist within the Frak ecosystem"
            );
        }

        return {
            id: data.merchantId as Hex,
            onChainMetadata: {
                name: data.name ?? "",
                domain: new URL(context.sourceUrl).host.replace("www.", ""),
            },
            maxReferrer: undefined,
            maxReferee: undefined,
            rewards: [],
        } satisfies GetMerchantInformationReturnType;
    }, []);
}
