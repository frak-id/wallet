import { changeIframeVisibility } from "../utils/iframeHelper";

/**
 * Setup the privy communication channel
 * @param embeddedWalletUrl
 * @param onPrivyResponse
 */
export async function setupPrivyChannel({
    embeddedWalletUrl,
    onPrivyResponse,
}: {
    embeddedWalletUrl: string;
    onPrivyResponse: (data: unknown) => void;
}) {
    // Setup the iframe
    const privyIFrame = await setupPrivyIframe({ embeddedWalletUrl });

    // Create the msg handler that will receive privy events
    const msgHandler = async (event: MessageEvent) => {
        // Check that the origin match the privy one
        if (
            new URL(event.origin).origin.toLowerCase() !==
            new URL(embeddedWalletUrl).origin.toLowerCase()
        ) {
            return;
        }

        // Then send back the event to privy
        onPrivyResponse(event.data);
    };
    // Add it to the window
    window.addEventListener("message", msgHandler);

    // Small function helping to send msg to the privy iframe
    const sendPrivyRequest = (data: unknown, targetOrigin: string) => {
        privyIFrame.contentWindow?.postMessage(data, targetOrigin);
    };

    // Function used to destroy the privy channel
    const destroy = () => {
        // Remove the event listener
        window.removeEventListener("message", msgHandler);
        // Remove the iframe
        privyIFrame.remove();
    };

    return {
        // Expose the destroy and send privy request function
        sendPrivyRequest,
        destroy,
    };
}

/**
 * Create the privy iframe for the given embedded wallet url
 * @param embeddedWalletUrl
 */
function setupPrivyIframe({
    embeddedWalletUrl,
}: { embeddedWalletUrl: string }): Promise<HTMLIFrameElement> {
    // Create the privy iframe if it doesn't exist yet
    const existingPrivyIFrame = document.getElementById("frak-privy-iframe");
    if (existingPrivyIFrame) {
        existingPrivyIFrame.remove();
    }

    // Set it up
    const privyIFrame = document.createElement("iframe");
    privyIFrame.id = "frak-privy-iframe";
    privyIFrame.name = "frak-privy-iframe";
    privyIFrame.src = embeddedWalletUrl;
    changeIframeVisibility({ iframe: privyIFrame, isVisible: false });
    document.body.appendChild(privyIFrame);
    return new Promise((resolve) => {
        privyIFrame?.addEventListener("load", () => resolve(privyIFrame));
        privyIFrame.src = embeddedWalletUrl;
    });
}
