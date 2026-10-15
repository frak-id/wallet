import type { IFrameLifecycleEvent } from "../../types";

/**
 * What the page saw of the listener before the RPC client existed: the
 * listener's boot-time `connected` lands before the client listens.
 * @ignore
 */
export type IframeBootObservation = {
    createdAt: number;
    loadedAt?: number;
    listenerSeen: boolean;
    bootError?: string;
};

const observations = new WeakMap<HTMLIFrameElement, IframeBootObservation>();
const stoppers = new WeakMap<HTMLIFrameElement, () => void>();

/**
 * Start watching an iframe before its `src` is set.
 * @ignore
 */
export function observeIframeBoot(
    iframe: HTMLIFrameElement,
    walletUrl: string
): void {
    const walletOrigin = new URL(walletUrl).origin;
    const observation: IframeBootObservation = {
        createdAt: Date.now(),
        listenerSeen: false,
    };
    observations.set(iframe, observation);

    iframe.addEventListener(
        "load",
        () => {
            observation.loadedAt ??= Date.now();
        },
        { once: true }
    );

    const onMessage = (event: MessageEvent<unknown>) => {
        if (event.origin !== walletOrigin) return;
        if (event.source !== iframe.contentWindow) return;
        observation.listenerSeen = true;
        const data = event.data as Partial<IFrameLifecycleEvent> | null;
        if (typeof data !== "object" || data === null) return;
        if (data.iframeLifecycle === "boot-error") {
            const message = (data.data as { message?: unknown } | undefined)
                ?.message;
            if (typeof message === "string") {
                observation.bootError = message.slice(0, 200);
            }
            return;
        }
        if (data.iframeLifecycle === "connected") {
            stopIframeBootObservation(iframe);
        }
    };
    window.addEventListener("message", onMessage);
    stoppers.set(iframe, () =>
        window.removeEventListener("message", onMessage)
    );
}

/** @ignore */
export function stopIframeBootObservation(iframe: HTMLIFrameElement): void {
    stoppers.get(iframe)?.();
    stoppers.delete(iframe);
}

/** @ignore */
export function getIframeBootObservation(
    iframe: HTMLIFrameElement
): IframeBootObservation | undefined {
    return observations.get(iframe);
}
