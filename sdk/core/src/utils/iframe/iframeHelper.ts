import { initClientId } from "../../config/clientId";
import {
    getBackendUrl,
    getWalletUrl,
    setEnvironment,
} from "../../config/environment";
import type { FrakWalletSdkConfig, ListenerPreloadOption } from "../../types";

/**
 * Base props for the iframe
 * @ignore
 */
export const baseIframeProps = {
    id: "frak-wallet",
    name: "frak-wallet",
    title: "Frak Wallet",
    allow: "publickey-credentials-get *; clipboard-write; web-share *",
    style: {
        width: "0",
        height: "0",
        border: "0",
        position: "absolute",
        zIndex: 2000001,
        top: "-1000px",
        left: "-1000px",
        colorScheme: "auto",
    },
};

/**
 * Create the Frak iframe
 * @param args
 * @param args.config - The configuration object containing iframe options.
 */
export async function createIframe({
    config,
}: {
    config?: FrakWalletSdkConfig;
}): Promise<HTMLIFrameElement | undefined> {
    // Check if the iframe is already created
    const alreadyCreatedIFrame = document.querySelector("#frak-wallet");

    // If the iframe is already created, remove it
    if (alreadyCreatedIFrame) {
        alreadyCreatedIFrame.remove();
    }

    const iframe = document.createElement("iframe");

    // Set the base iframe props
    iframe.id = baseIframeProps.id;
    iframe.name = baseIframeProps.name;
    iframe.allow = baseIframeProps.allow;
    iframe.style.zIndex = baseIframeProps.style.zIndex.toString();

    changeIframeVisibility({ iframe, isVisible: false });

    // Publish the environment before anything reads it back: this is the
    // earliest point in the setup path, and `initClientId` below already
    // needs the backend origin.
    // Set src BEFORE appending to DOM to avoid about:blank load event
    const walletUrl = setEnvironment(config?.env).wallet;

    // Key generation happens here, once ever per browser, before `iframe.src`
    // is assigned — every other `getClientId()` call site runs after this
    // resolves and reads the populated module cache. Uses the resolved value
    // directly rather than a follow-up `getClientId()` call, since the
    // listener URL must never carry `clientId=undefined`; on failure the
    // iframe is built without the param and falls back to the persisted store.
    const clientId = await initClientId().catch((error) => {
        console.warn("[Frak SDK] Unable to derive a client id", error);
        return undefined;
    });

    // Preconnect to the wallet + backend origins so the handshake doesn't pay
    // for a cold DNS/TLS round-trip on partner sites that didn't warm them.
    preconnect(walletUrl);
    preconnect(getBackendUrl());

    iframe.src = buildListenerUrl({
        walletUrl,
        clientId,
        preload: config?.preload,
    });

    return new Promise((resolve) => {
        iframe.addEventListener("load", () => resolve(iframe));
        document.body.appendChild(iframe);
    });
}

/**
 * Build the listener iframe URL.
 *
 * Exported so every iframe creator (here and `@frak-labs/react-sdk`'s
 * provider) builds the same URL — they drifted before, and a missing
 * `clientId` param silently costs the listener its SDK-seeded identity.
 *
 * Query params:
 *  - `clientId` — anonymous SDK client identifier used for funnel joining.
 *    Omitted entirely when derivation failed; never serialised as
 *    `"undefined"`. The listener then falls back to its persisted store.
 *
 * Hash params (consumed by `apps/listener/app/bootstrap.ts#setupPreloadHints`):
 *  - `preload=modal,sharing` — idle-warms the matching Ring 1 + Ring 2 chunks.
 *    Skipped entirely when no preload hints are provided so the listener
 *    doesn't pay for warm-ups that nobody asked for.
 */
export function buildListenerUrl({
    walletUrl = getWalletUrl(),
    clientId,
    preload,
}: {
    walletUrl?: string;
    clientId?: string;
    preload?: ListenerPreloadOption[];
}): string {
    const base = clientId
        ? `${walletUrl}/listener?clientId=${encodeURIComponent(clientId)}`
        : `${walletUrl}/listener`;
    if (!preload || preload.length === 0) return base;
    return `${base}#preload=${preload.join(",")}`;
}

/**
 * Change the visibility of the given iframe
 * @ignore
 */
export function changeIframeVisibility({
    iframe,
    isVisible,
}: {
    iframe: HTMLIFrameElement;
    isVisible: boolean;
}) {
    if (!isVisible) {
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.position = "fixed";
        iframe.style.top = "-1000px";
        iframe.style.left = "-1000px";
        return;
    }

    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.pointerEvents = "auto";
}

/**
 * Find an iframe within window.opener by pathname
 *
 * When a popup is opened via window.open from an iframe, window.opener points to
 * the parent window, not the iframe itself. This utility searches through all frames
 * in window.opener to find an iframe matching the specified pathname.
 *
 * @param pathname - The pathname to search for (default: "/listener")
 * @returns The matching iframe window, or null if not found
 *
 * @example
 * ```typescript
 * // Find the default /listener iframe
 * const listenerIframe = findIframeInOpener();
 *
 * // Find a custom iframe
 * const customIframe = findIframeInOpener("/my-custom-iframe");
 * ```
 */
export function findIframeInOpener(pathname = "/listener"): Window | null {
    if (!window.opener) return null;

    const frameCheck = (frame: Window) => {
        try {
            return (
                frame.location.origin === window.location.origin &&
                frame.location.pathname === pathname
            );
        } catch {
            // Cross-origin frame, skip
            return false;
        }
    };

    // Check if the openner window is the right one
    if (frameCheck(window.opener)) return window.opener;

    // Search through frames in window.opener
    try {
        const frames = window.opener.frames;
        for (let i = 0; i < frames.length; i++) {
            if (frameCheck(frames[i])) {
                return frames[i];
            }
        }
        return null;
    } catch (error) {
        console.error(
            `[findIframeInOpener] Error finding iframe with pathname ${pathname}:`,
            error
        );
        return null;
    }
}

/**
 * Inject a `<link rel="preconnect">` for the given origin. Idempotent — browsers
 * de-duplicate preconnects per origin automatically, but we also guard on a data
 * attribute to avoid spamming the <head> in SPA re-inits.
 */
function preconnect(url: string): void {
    if (typeof document === "undefined") return;
    try {
        const origin = new URL(url).origin;
        const selector = `link[rel="preconnect"][data-frak-preconnect="${origin}"]`;
        if (document.head.querySelector(selector)) return;
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = origin;
        link.crossOrigin = "";
        link.dataset.frakPreconnect = origin;
        document.head.appendChild(link);
    } catch {
        // Invalid URL — nothing to preconnect.
    }
}
