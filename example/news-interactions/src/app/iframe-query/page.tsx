"use client";

import { ClientOnly } from "@module/component/ClientOnly";
import { createElement, useMemo, useState } from "react";

export default function IFrameTesterQuerier() {
    return (
        <ClientOnly>
            <div>
                <h1>Iframe tester querier</h1>
                <hr />
                <IFrameClientProvider />
            </div>
        </ClientOnly>
    );
}

/**
 * IFrame client provider for the Nexus Wallet SDK
 *  - Automatically set the config provider
 * @constructor
 */
function IFrameClientProvider() {
    const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | undefined>(
        undefined
    );

    // Create the iframe-query that will be used to communicate with the wallet
    const iframeElem = createElement("iframe", {
        allow: "publickey-credentials-get *; clipboard-write; web-share *",
        height: "600",
        width: "400",
        // src: "http://localhost:3000/iframe",
        src: "https://nexus-dev.frak.id/iframe",
        ref: (iframe: HTMLIFrameElement) => {
            if (!iframe) {
                return;
            }
            setIframeRef(iframe);
        },
    });

    const [lastResponse, setLastResponse] = useState<string | undefined>(
        undefined
    );

    useMemo(() => {
        if (!window) return;

        // Define the message listener
        const onMessage = async (
            message: MessageEvent<{
                testStorageResponse?: boolean;
                testStorageItem?: string;
            }>
        ) => {
            if (!message.data?.testStorageResponse) {
                return;
            }
            setLastResponse(message.data.testStorageItem ?? "No response");
            console.log("Received a response from the iframe-query", message);
        };

        // Add the message listener
        window.addEventListener("message", onMessage);

        // Small cleanup function
        return () => {
            window.removeEventListener("message", onMessage);
        };
    }, []);

    return (
        <div>
            <h2>IFrame query</h2>
            <button
                onClick={() => {
                    iframeRef?.contentWindow?.postMessage(
                        {
                            testStorageAccess: true,
                        },
                        "*"
                    );
                }}
                type={"button"}
            >
                Request storage read
            </button>

            <hr />
            <p>Response: {lastResponse}</p>
            <h2>Iframe</h2>
            {iframeElem}
        </div>
    );
}
