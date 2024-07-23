import { frakChainId } from "@/context/blockchain/provider";
import { getArticlePricesForUser } from "@/context/paywall/action/getPrices";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { getErc20Balance } from "@/context/tokens/action/getBalance";
import { sessionAtom } from "@/module/common/atoms/session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { jotaiStore } from "@module/atoms/store";
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
export function useGetArticleUnlockOptionsListener(): OnGetArticleUnlockOptions {
    /**
     * The function that will be called when the unlock options for an article is requested
     * @param _
     * @param emitter
     */
    return useCallback(async (params, _, emitter) => {
        // Extract the contentId and articleId
        const contentId = params.params[0];
        const articleId = params.params[1];

        // If no contentId or articleId, return
        if (!(contentId && articleId)) {
            await emitter({ result: { prices: [] } });
            return;
        }

        // Get the current user session
        const session = jotaiStore.get(sessionAtom);

        // Fetch the prices
        const prices = await getArticlePricesForUser({
            contentId,
            articleId,
            address: session?.wallet?.address ?? undefined,
        });

        // If we don't have any session, return
        if (!session) {
            await emitter({ result: { prices: prices } });
            return;
        }

        // Otherwise, fetch the balance
        const balance = await getErc20Balance({
            wallet: session.wallet.address,
            chainId: frakChainId,
            token: addresses.paywallToken,
        });

        // Send the prices
        await emitter({
            result: {
                prices: prices,
                frkBalanceAsHex: balance ? toHex(BigInt(balance)) : undefined,
            },
        });
    }, []);
}
