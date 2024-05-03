import { setUserReferredOnContent } from "@/context/referral/action/userReferredOnContent";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue } from "jotai";
import { useCallback } from "react";

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
     * The function that will be called when a user referred is requested
     * @param request
     * @param emitter
     */
    const onUserReferredListenRequest: OnListenToUserReferred = useCallback(
        async (request, emitter) => {
            // Extract the contentId and walletAddress
            const contentId = request.params[0];
            const walletAddress = request.params[1];

            // If no contentId or articleId, return
            if (!(contentId && walletAddress && session?.wallet?.address)) {
                return;
            }

            await setUserReferredOnContent({
                user: session?.wallet?.address,
                referrer: walletAddress,
                contentId,
            });

            // Send the response
            await emitter({
                key: "connected",
            });
        },
        [session?.wallet?.address]
    );

    return {
        onUserReferredListenRequest,
    };
}
