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
} from "@frak-labs/wallet-shared/common/utils/safeSession";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
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
 * Vanilla factory for the `frak_listenToWalletStatus` stream handler.
 *
 * Subscribes to the session store and emits status updates to the SDK.
 * Each new RPC stream supersedes the previous one (only one partner site
 * per iframe), so we keep a single module-level unsubscribe handle.
 */
export function createWalletStatusHandler(): OnListenToWallet {
    let activeUnsubscribe: (() => void) | null = null;

    async function emitCurrentStatus(
        emitter: StreamEmitter<WalletStatusReturnType>,
        domain: string,
        signal: AbortSignal
    ) {
        if (signal.aborted) return;

        const wallet =
            sessionStore.getState().session ?? getSafeSession();
        const sdk =
            sessionStore.getState().sdkSession ?? getSafeSdkSession();

        if (!wallet?.address) {
            emitter({ key: "not-connected" });
            await pushBackupData({ domain });
            return;
        }

        if (signal.aborted) return;

        emitter({
            key: "connected",
            wallet: wallet.address,
            interactionToken: sdk?.token,
        });

        if (signal.aborted) return;

        await pushBackupData({ domain });
    }

    return async (_params, emitter, context) => {
        // Tear down any previous subscription before starting a new one.
        activeUnsubscribe?.();
        activeUnsubscribe = null;

        let abortController = new AbortController();
        const domain = extractDomainFromUrl(context.sourceUrl);

        await emitCurrentStatus(emitter, domain, abortController.signal);

        const unsubscribe = sessionStore.subscribe(() => {
            abortController.abort();
            abortController = new AbortController();
            void emitCurrentStatus(
                emitter,
                domain,
                abortController.signal
            );
        });
        activeUnsubscribe = unsubscribe;
    };
}
