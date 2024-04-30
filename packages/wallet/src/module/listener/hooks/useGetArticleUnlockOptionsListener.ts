import { getArticlePricesForUser } from "@/context/paywall/action/getPrices";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { useFrkBalance } from "@/module/wallet/hook/useFrkBalance";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { toHex } from "viem";

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
     * Listen to the current session FRK balance if needed
     */
    const { rawBalance, refreshBalance } = useFrkBalance({
        wallet: session?.wallet?.address,
    });

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

            // Fetch the balance if not already here
            const balance = rawBalance ?? (await refreshBalance()).data;

            // Send the prices
            await emitter({
                prices: prices,
                frkBalanceAsHex: balance ? toHex(BigInt(balance)) : undefined,
            });
        },
        [session?.wallet?.address, rawBalance, refreshBalance]
    );

    return { onGetArticleUnlockOptions };
}
