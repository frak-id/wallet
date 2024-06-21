"use client";

import type { DashboardActionReturnType } from "@frak-labs/nexus-sdk/core";
import { useDashboardAction } from "@frak-labs/nexus-sdk/react";

export default function RestrictedPage() {
    function callbackResponse({ key }: DashboardActionReturnType) {
        console.log("callbackResponse", key);
        if (key === "action-successful") {
            document
                .querySelector("#nexus-wallet")
                ?.classList.remove("visible");
        }
    }

    const { mutate: launchAction } = useDashboardAction({
        action: "open",
        callback: callbackResponse,
    });

    return (
        <>
            <p>dashboard</p>
            <p>
                <button
                    type={"button"}
                    className={"button"}
                    onClick={() => {
                        launchAction();
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
