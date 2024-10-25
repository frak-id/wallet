import type { NexusWalletSdkConfig } from "../types";
import { hideButtonShare } from "./buttonShare";

/**
 * Base props for the iframe
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
 * Create the given iframe
 * @param walletBaseUrl
 * @param config
 */
export function createIframe({
    walletBaseUrl,
    config,
}: { walletBaseUrl: string; config?: NexusWalletSdkConfig }): Promise<
    HTMLIFrameElement | undefined
> {
    // Hide the share button by default until the iframe is loaded and connected
    hideButtonShare(config);

    // Check if the iframe is already created
    const alreadyCreatedIFrame = document.querySelector("#nexus-wallet");

    // If the iframe is already created, return it
    if (alreadyCreatedIFrame) {
        return Promise.resolve(alreadyCreatedIFrame as HTMLIFrameElement);
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
        iframe.src = `${walletBaseUrl}/listener`;
    });
}
/**
 * Change the visibility of the given iframe
 * @param iframe
 * @param isVisible
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
