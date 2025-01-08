import { createElement, useEffect, useState } from "react";
import { usePrivyContext } from "./PrivyProvider";

/**
 * Craft the privy message handler provider in the wallet context
 * @constructor
 */
export function PrivyWalletMessageProvider() {
    const { client } = usePrivyContext();
    const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null);

    /**
     * Once the iframe of the client change, register the new iframe
     */
    useEffect(() => {
        if (!(iframe?.contentWindow && client)) {
            console.log("No iframe or client found");
            return;
        }
        // Set the message poster for the client
        client.setMessagePoster({
            postMessage: (data, targetOrigin) => {
                iframe.contentWindow?.postMessage(data, targetOrigin);
            },
        });

        // Add the client's message handler as a event listener
        const targetOrigin = new URL(client.embeddedWallet.getURL()).origin;
        const msgHandler = (e: MessageEvent) => {
            // Filter on the msg origin
            if (e.origin !== targetOrigin) return;
            // Transmit them to privy if that's good
            client.embeddedWallet.onMessage(e.data);
        };
        window.addEventListener("message", msgHandler);

        // Remove the event listener when the component is unmounted
        return () => {
            window.removeEventListener("message", msgHandler);
        };
    }, [iframe, client]);

    // Create the iframe that will be used to communicate with the wallet
    return createElement("iframe", {
        id: "frak-privy-iframe",
        style: {
            width: "0",
            height: "0",
            border: "0",
            position: "absolute",
            zIndex: 1000,
            top: "-1000px",
            left: "-1000px",
        },
        src: client.embeddedWallet.getURL(),
        ref: (iframe: HTMLIFrameElement) => {
            setIframe(iframe);
        },
    });
}
