import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { keccak256, toHex } from "viem";

/**
 * Check if we currently are in an iframe
 */
export function isInIframe() {
    return window.self !== window.top;
}

/**
 * Get the current iFrame resolving context
 */
export function getIFrameResolvingContext():
    | IFrameResolvingContext
    | undefined {
    // Get the referrer of the iframe
    const referrer = document.referrer;
    if (!(isInIframe() && referrer)) {
        console.log("Not in an iframe or no origin", {
            isInIframe: isInIframe(),
            referrer,
        });
        return undefined;
    }

    // Map the origin to an url and compute the product id
    const originUrl = new URL(referrer);
    const productId = keccak256(toHex(originUrl.hostname));
    const origin = originUrl.origin;

    console.log("Computed resolving context", {
        referrer,
        productId,
    });

    // Return the context
    return { productId, origin };
}
