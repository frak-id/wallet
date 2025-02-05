import { isRunningInProd } from "@frak-labs/app-essentials";
import { useMemo } from "react";

/**
 * Send a ping to the metrics server
 */
export function useSendPing() {
    return useMemo(async () => {
        if (!isRunningInProd) return;

        fetch("https://metrics.frak.id/ping", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ua: navigator.userAgent }),
        });
    }, []);
}
