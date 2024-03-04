/**
 * Create the given iframe
 * @param walletBaseUrl
 */
export function createIframe({
    walletBaseUrl,
}: { walletBaseUrl: string }): Promise<HTMLIFrameElement | undefined> {
    // Check if the iframe is already created
    const isAlreadyCreated = document.querySelector("#nexus-wallet");

    // If the iframe is already created, return undefined
    if (isAlreadyCreated) {
        return Promise.resolve(undefined);
    }

    const iframe = document.createElement("iframe");
    iframe.name = "nexus-wallet";
    iframe.id = "nexus-wallet";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.position = "absolute";
    iframe.style.top = "-1000px";
    iframe.style.left = "-1000px";
    document.body.appendChild(iframe);

    return new Promise((resolve) => {
        iframe?.addEventListener("load", () => resolve(iframe));
        iframe.src = `${walletBaseUrl}/listener`;
    });
}
