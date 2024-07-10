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
    iframe.name = "nexus-wallet";
    iframe.id = "nexus-wallet";
    iframe.style.zIndex = "1000";
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
