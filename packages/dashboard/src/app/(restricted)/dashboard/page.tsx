"use client";

import { useEffect } from "react";

export default function RestrictedPage() {
    function msgHandler(event: MessageEvent) {
        if (!event.origin) {
            return;
        }
        // Check that the origin match the wallet
        if (
            new URL(event.origin).origin.toLowerCase() !==
            new URL(process.env.NEXUS_WALLET_URL as string).origin.toLowerCase()
        ) {
            return;
        }
        // On action close, close the iframe
        if (event.data?.action === "close") {
            document
                .querySelector("#nexus-wallet")
                ?.classList.remove("visible");
        }
    }

    useEffect(() => {
        window.addEventListener("message", msgHandler);
    }, [msgHandler]);

    return (
        <>
            <p>dashboard</p>
            <p>
                <button
                    type={"button"}
                    className={"button"}
                    onClick={() => {
                        document
                            .querySelector("#nexus-wallet")
                            ?.classList.add("visible");
                    }}
                >
                    open iframe interaction
                </button>
            </p>
        </>
    );
}
