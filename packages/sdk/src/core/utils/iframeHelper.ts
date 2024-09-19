/**
 * Base props for the iframe
 */
export const baseIframeProps = {
    id: "nexus-wallet",
    name: "nexus-wallet",
    allow: "publickey-credentials-get *; clipboard-write; web-share *",
    style: {
        width: "100%",
        height: "100%",
        border: "0",
        position: "fixed",
        zIndex: 1000,
        top: "-10000px",
        left: "-10000px",
    },
};

/**
 * Create the given iframe
 * @param walletBaseUrl
 */
export function createIframe({
    walletBaseUrl,
}: { walletBaseUrl: string }): Promise<HTMLIFrameElement | undefined> {
    // Check if the iframe is already created
    const alreadyCreatedIFrame = document.querySelector("#nexus-wallet");

    // If the iframe is already created, return undefined
    if (alreadyCreatedIFrame) {
        return Promise.resolve(undefined);
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
        iframe.style.top = "-10000px";
        iframe.style.left = "-10000px";
        return;
    }

    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.pointerEvents = "auto";
}
