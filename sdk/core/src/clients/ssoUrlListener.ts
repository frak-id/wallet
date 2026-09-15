import type { RpcClient } from "@frak-labs/frame-connector";
import type { FrakLifecycleEvent } from "../types";
import type { IFrameRpcSchema } from "../types/rpc";

/**
 * Forward a compressed `sso` URL param to the iframe as a lifecycle event and
 * strip it from the URL immediately, so it never lands in browser history.
 */
export function setupSsoUrlListener(
    rpcClient: RpcClient<IFrameRpcSchema, FrakLifecycleEvent>,
    waitForConnection: Promise<boolean>
): void {
    if (typeof window === "undefined") {
        return;
    }

    const url = new URL(window.location.href);
    const compressedSso = url.searchParams.get("sso");

    if (!compressedSso) {
        return;
    }

    // Forwarded compressed: the iframe owns decompression.
    waitForConnection
        .then(() => {
            rpcClient.sendLifecycle({
                clientLifecycle: "sso-redirect-complete",
                data: { compressed: compressedSso },
            });
        })
        .catch((error) => {
            console.error(
                "[SSO URL Listener] Failed to forward SSO data:",
                error
            );
        });

    url.searchParams.delete("sso");
    window.history.replaceState({}, "", url.toString());
}
