import { getArticlePricesForUser } from "@/context/paywall/action/getPrices";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

type OnGetArticleUnlockOptions = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_getArticleUnlockOptions" }
    >
>;

/**
 * Hook use to answer the get article unlock options request
 */
export function useGetArticleUnlockOptionsListener() {
    // Fetch the current user session
    const session = useAtomValue(sessionAtom);

    /**
     * The function that will be called when the unlock options for an article is requested
     * @param _
     * @param emitter
     */
    const onGetArticleUnlockOptions: OnGetArticleUnlockOptions = useCallback(
        async (params, emitter) => {
            // Extract the contentId and articleId
            const contentId = params.params[0];
            const articleId = params.params[1];

            // If no contentId or articleId, return
            if (!(contentId && articleId)) {
                await emitter({ prices: [] });
                return;
            }

            // Fetch the prices
            const prices = await getArticlePricesForUser({
                contentId,
                articleId,
                address: session?.wallet?.address ?? undefined,
            });

            // Send the prices
            await emitter({ prices: prices });
        },
        [session?.wallet?.address]
    );

    return { onGetArticleUnlockOptions };
}
