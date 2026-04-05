import type {
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import type {
    RpcStreamHandler,
    StreamEmitter,
} from "@frak-labs/frame-connector";
import {
    getSafeSdkSession,
    getSafeSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import type { WalletRpcContext } from "@/module/types/context";
import { pushBackupData } from "@/module/utils/backup";

function extractDomainFromUrl(url: string): string {
    try {
        return new URL(url).host.replace("www.", "");
    } catch {
        return url;
    }
}

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

    useEffect(() => {
        sessionsRef.current = { wallet: session, sdk: sdkSession };
    }, [session, sdkSession]);

    const emitCurrentStatus = useCallback(
        async (
            emitter: StreamEmitter<WalletStatusReturnType>,
            domain: string,
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
                await pushBackupData({ domain });
                return;
            }

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
            });

            // Check again if aborted before pushing backup data
            if (signal?.aborted) {
                console.info("emitCurrentStatus operation aborted");
                return;
            }

            await pushBackupData({ domain });
        },
        []
    );

    // Clean up on unmount
    useEffect(() => {
        return () => {
            unsubscribeRef.current?.();
        };
    }, []);

    return useCallback(
        async (_params, emitter, context) => {
            // Clean up previous subscription if it exists
            unsubscribeRef.current?.();

            let abortController = new AbortController();

            const domain = extractDomainFromUrl(context.sourceUrl);

            await emitCurrentStatus(emitter, domain, abortController.signal);

            unsubscribeRef.current = sessionStore.subscribe(() => {
                abortController.abort();
                abortController = new AbortController();
                emitCurrentStatus(emitter, domain, abortController.signal);
            });
        },
        [emitCurrentStatus]
    );
}
