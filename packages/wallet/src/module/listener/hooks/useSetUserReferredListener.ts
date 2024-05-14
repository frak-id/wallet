import { setUserReferredOnContent } from "@/context/referral/action/userReferredOnContent";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { addReferrerToHistoryAtom } from "@/module/listener/atoms/referralHistory";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { isAddressEqual } from "viem";

type OnListenToUserReferred = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToSetUserReferred" }
    >
>;

/**
 * Hook use to listen to the user referred
 */
export function useSetUserReferredListener() {
    /**
     * Get the current user session
     */
    const session = useAtomValue(sessionAtom);

    /**
     * Set the referral history atom
     */
    const addReferrerToHistory = useSetAtom(addReferrerToHistoryAtom);

    /**
     * The function that will be called when a user referred is requested
     * @param request
     * @param emitter
     */
    const onUserReferredListenRequest: OnListenToUserReferred = useCallback(
        async (request, emitter) => {
            // Extract the contentId and walletAddress
            const contentId = request.params[0];
            const referrerAddress = request.params[1];
            const userAddress = session?.wallet?.address;

            // If no contentId or articleId, return
            if (!(contentId && referrerAddress)) {
                return;
            }

            // If no current wallet present
            if (!userAddress) {
                addReferrerToHistory({
                    referrer: referrerAddress,
                    contentId,
                });
                // Send the response
                await emitter({
                    key: "referred-history",
                });
                // And exit
                return;
            }

            // If the referrer is the same as the current wallet address, do nothing
            if (isAddressEqual(userAddress, referrerAddress)) {
                // Send the response
                await emitter({
                    key: "same-wallet",
                });
                return;
            }

            // Otherwise, just set the user referred on content
            await setUserReferredOnContent({
                user: userAddress,
                referrer: referrerAddress,
                contentId,
            });
            // Send the response
            await emitter({
                key: "referred-successful",
            });
        },
        [session?.wallet?.address, addReferrerToHistory]
    );

    return {
        onUserReferredListenRequest,
    };
}
