import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { useEffect } from "react";
import { usePrivyContext } from "./PrivyProvider";

/**
 * Craft the privy message handler provider in the SDK context
 *
 * We rely on the iFrameRequestResolver for the `setup-privy` and response submitting part
 *
 * Here we only push privy request
 * @constructor
 */
export function PrivySdkMessageProvider() {
    const { client } = usePrivyContext();

    /**
     * Once the iframe of the client change, register the new iframe
     */
    useEffect(() => {
        client.setMessagePoster({
            postMessage: (data, targetOrigin) => {
                // Post the message to the iframe
                emitLifecycleEvent({
                    iframeLifecycle: "privy-request",
                    data,
                    targetOrigin,
                });
            },
        });
    }, [client]);

    return <></>;
}
