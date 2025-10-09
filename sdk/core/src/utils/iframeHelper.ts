import type { FrakWalletSdkConfig } from "../types";

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
 * @param args.walletBaseUrl - Use `config.walletUrl` instead. Will be removed in future versions.
 * @param args.config - The configuration object containing iframe options, including the replacement for `walletBaseUrl`.
 */
export function createIframe({
    walletBaseUrl,
    config,
}: { walletBaseUrl?: string; config?: FrakWalletSdkConfig }): Promise<
    HTMLIFrameElement | undefined
> {
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
    document.body.appendChild(iframe);

    return new Promise((resolve) => {
        iframe?.addEventListener("load", () => resolve(iframe));
        iframe.src = `${config?.walletUrl ?? walletBaseUrl ?? "https://wallet.frak.id"}/listener`;
    });
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

    try {
        const frames = window.opener.frames;
        return Array.from(
            { length: frames.length },
            (_, i) => i
        ).reduce<Window | null>((foundFrame, i) => {
            if (foundFrame) return foundFrame;
            try {
                const frame = frames[i];
                if (
                    frame.location.origin === window.location.origin &&
                    frame.location.pathname === pathname
                ) {
                    return frame;
                }
            } catch {
                // Cross-origin frame, skip
            }
            return foundFrame;
        }, null);
    } catch (error) {
        console.error(
            `[findIframeInOpener] Error finding iframe with pathname ${pathname}:`,
            error
        );
        return null;
    }
}
