import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { pushBackupData } from "@/context/sdk/utils/backup";
import type {
    IFrameRequestResolver,
    IFrameResolvingContext,
    IFrameResponseEmitter,
} from "@/context/sdk/utils/iFrameRequestResolver";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { getFromLocalStorage } from "@/module/listener/utils/localStorage";
import type { SdkSession, Session } from "@/types/Session";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { atom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";

type OnListenToWallet = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToWalletStatus" }
    >
>;

const bothSessionsAtom = atom((get) => ({
    wallet: get(sessionAtom),
    sdk: get(sdkSessionAtom),
}));

/**
 * Hook use to listen to the wallet status
 */
export function useWalletStatusListener(): OnListenToWallet {
    // Read from the jotai store
    const bothSessions = useAtomValue(bothSessionsAtom);
    const sessionsRef = useRef(undefined as typeof bothSessions | undefined);
    useEffect(() => {
        sessionsRef.current = bothSessions;
    }, [bothSessions]);

    /**
     * Emit the current wallet status
     * @param emitter
     */
    const emitCurrentStatus = useCallback(
        async (
            context: IFrameResolvingContext,
            emitter: IFrameResponseEmitter<{
                method: "frak_listenToWalletStatus";
            }>,
            signal?: AbortSignal
        ) => {
            // Check if the operation has been aborted
            if (signal?.aborted) {
                console.info("emitCurrentStatus operation aborted");
                return;
            }

            // If ref not loaded yet, early exit
            const current = sessionsRef.current;
            if (!current) {
                return;
            }

            const wallet =
                current.wallet ??
                jotaiStore.get(sessionAtom) ??
                getFromLocalStorage<Session>("frak_session");
            const sdk =
                current.sdk ??
                jotaiStore.get(sdkSessionAtom) ??
                getFromLocalStorage<SdkSession>("frak_sdkSession");

            // If no wallet present, just return the not logged in status
            if (!wallet?.address) {
                await emitter({
                    result: {
                        key: "not-connected",
                    },
                });
                // And push fresh backup data with no session
                await pushBackupData({
                    productId: context.productId,
                });
                return;
            }

            // Get the on chain status
            const interactionSession = await getSessionStatus({
                wallet: wallet.address,
            }).then((interactionSession) =>
                interactionSession
                    ? {
                        startTimestamp: interactionSession.sessionStart,
                        endTimestamp: interactionSession.sessionEnd,
                    }
                    : undefined
            );

            // Check again if aborted before emitting
            if (signal?.aborted) {
                console.info("emitCurrentStatus operation aborted");
                return;
            }

            // Emit the event
            await emitter({
                result: {
                    key: "connected",
                    wallet: wallet.address,
                    interactionToken: sdk?.token,
                    interactionSession,
                },
            });

            // Check again if aborted before pushing backup data
            if (signal?.aborted) {
                console.info("emitCurrentStatus operation aborted");
                return;
            }

            // And push some backup data if we got ones
            await pushBackupData({
                productId: context.productId,
            });
        },
        []
    );

    /**
     * The function that will be called when a wallet status is requested
     * @param _
     * @param emitter
     */
    return useCallback(
        async (_, context, emitter) => {
            let abortController = new AbortController();

            // Emit the first status
            await emitCurrentStatus(context, emitter, abortController.signal);

            // Listen to jotai store update
            jotaiStore.sub(sessionAtom, () => {
                abortController.abort();
                abortController = new AbortController();
                emitCurrentStatus(context, emitter, abortController.signal);
            });
            jotaiStore.sub(sdkSessionAtom, () => {
                abortController.abort();
                abortController = new AbortController();
                emitCurrentStatus(context, emitter, abortController.signal);
            });
        },
        [emitCurrentStatus]
    );
}
