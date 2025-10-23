import type {
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import type {
    RpcStreamHandler,
    StreamEmitter,
} from "@frak-labs/frame-connector";
import { pushBackupData } from "@frak-labs/wallet-shared/sdk/utils/backup";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { interactionSessionStatusQuery } from "@frak-labs/wallet-shared/wallet/hook/useInteractionSessionStatus";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { WalletRpcContext } from "@/module/types/context";
import { getSafeSdkSession, getSafeSession } from "@/module/utils/localStorage";

type OnListenToWallet = RpcStreamHandler<
    IFrameRpcSchema,
    "frak_listenToWalletStatus",
    WalletRpcContext
>;

/**
 * Hook use to listen to the wallet status
 */
export function useWalletStatusListener(): OnListenToWallet {
    // Read from the zustand store
    const session = sessionStore((state) => state.session);
    const sdkSession = sessionStore((state) => state.sdkSession);
    const sessionsRef = useRef<{
        wallet: typeof session;
        sdk: typeof sdkSession;
    }>({ wallet: session, sdk: sdkSession });
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Get our query client, to check if we got some cached data
    const queryClient = useQueryClient();

    useEffect(() => {
        sessionsRef.current = { wallet: session, sdk: sdkSession };
    }, [session, sdkSession]);

    /**
     * Emit the current wallet status
     * @param emitter
     * @param productId - From augmented context (Hex type)
     * @param signal
     */
    const emitCurrentStatus = useCallback(
        async (
            emitter: StreamEmitter<WalletStatusReturnType>,
            productId: `0x${string}`,
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

            const wallet = current.wallet ?? getSafeSession();
            const sdk = current.sdk ?? getSafeSdkSession();

            // If no wallet present, just return the not logged in status
            if (!wallet?.address) {
                emitter({
                    key: "not-connected",
                });
                // And push fresh backup data with no session
                await pushBackupData({ productId });
                return;
            }

            // Get the on chain status (or a cached version if present)
            const interactionSession = await queryClient
                .ensureQueryData(interactionSessionStatusQuery(wallet.address))
                .catch(() => undefined)
                .then((interactionSession) =>
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
            emitter({
                key: "connected",
                wallet: wallet.address,
                interactionToken: sdk?.token,
                interactionSession,
            });

            // Check again if aborted before pushing backup data
            if (signal?.aborted) {
                console.info("emitCurrentStatus operation aborted");
                return;
            }

            // And push some backup data if we got ones
            await pushBackupData({ productId });
        },
        [queryClient]
    );

    // Clean up on unmount
    useEffect(() => {
        return () => {
            unsubscribeRef.current?.();
        };
    }, []);

    /**
     * The function that will be called when a wallet status is requested
     * Context is augmented by middleware with productId, sourceUrl, etc.
     */
    return useCallback(
        async (_params, emitter, context) => {
            // Clean up previous subscription if it exists
            unsubscribeRef.current?.();

            let abortController = new AbortController();

            // Emit the first status (using productId from context)
            await emitCurrentStatus(
                emitter,
                context.productId,
                abortController.signal
            );

            // Listen to zustand store updates (both session and sdkSession)
            unsubscribeRef.current = sessionStore.subscribe(() => {
                abortController.abort();
                abortController = new AbortController();
                emitCurrentStatus(
                    emitter,
                    context.productId,
                    abortController.signal
                );
            });
        },
        [emitCurrentStatus]
    );
}
