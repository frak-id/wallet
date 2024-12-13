import type { FrakWalletSdkConfig } from "../types";

/**
 * Base props for the iframe
 * @ignore
 */
export const baseIframeProps = {
    id: "nexus-wallet",
    name: "nexus-wallet",
    allow: "publickey-credentials-get *; clipboard-write; web-share *",
    style: {
        width: "0",
        height: "0",
        border: "0",
        position: "absolute",
        zIndex: 1000,
        top: "-1000px",
        left: "-1000px",
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
    const alreadyCreatedIFrame = document.querySelector("#nexus-wallet");

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
}: { iframe: HTMLIFrameElement; isVisible: boolean }) {
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
