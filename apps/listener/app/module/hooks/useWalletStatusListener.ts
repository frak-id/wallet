import type {
    IFrameRpcSchema,
    WalletStatusReturnType,
} from "@frak-labs/core-sdk";
import type {
    RpcStreamHandler,
    StreamEmitter,
} from "@frak-labs/frame-connector";
import { ensureFreshSdkSession } from "@frak-labs/wallet-shared/common";
import { getSafeSession } from "@frak-labs/wallet-shared/common/utils/safeSession";
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
 *
 * Zombie-cleanup ownership [SF3]: this headless listener never clears storage
 * on an expired/stale session. It emits "not-connected" (inert, recoverable).
 * Only the wallet-app guard clears storage on dismiss-of-expired.
 */
export function createWalletStatusHandler(): OnListenToWallet {
    let activeUnsubscribe: (() => void) | null = null;

    async function emitCurrentStatus(
        emitter: StreamEmitter<WalletStatusReturnType>,
        domain: string,
        signal: AbortSignal
    ) {
        if (signal.aborted) return;

        const wallet = sessionStore.getState().session ?? getSafeSession();

        if (!wallet?.address) {
            emitter({ key: "not-connected" });
            await pushBackupData({ domain });
            return;
        }

        if (signal.aborted) return;

        // Ensure the SDK session is fresh, reminting from the wallet token via
        // /generate if near-expiry. The server 401 is the sole authority for a
        // "dead" wallet token — transient 5xx / offline returns "stale" and we
        // keep the user connected. We never logout on client-side exp or network
        // blips. [Authority principle, SF1]
        const r = await ensureFreshSdkSession();

        // Re-check abort AFTER the async renewal so a sessionStore.subscribe
        // that fired mid-await (and already started a fresh chain) does not
        // produce a duplicate emit from this now-superseded call. [SF1]
        if (signal.aborted) return;

        if (r.status === "dead") {
            // Server confirmed the wallet token is truly dead.
            // Do NOT clear storage here — see zombie-cleanup note above.
            emitter({ key: "not-connected" });
            await pushBackupData({ domain });
            return;
        }

        // "fresh" or "stale": keep the user connected. On "stale" (transient
        // failure), r.sdk may be null/undefined — interactionToken will be
        // absent but the user stays connected for non-interaction wallet actions.
        emitter({
            key: "connected",
            wallet: wallet.address,
            interactionToken: r.sdk?.token,
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
            void emitCurrentStatus(emitter, domain, abortController.signal);
        });
        activeUnsubscribe = unsubscribe;
    };
}
