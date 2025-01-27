import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import type { ClientLifecycleEvent } from "@frak-labs/core-sdk";
import { atom, useAtomValue } from "jotai";
import { keccak256, toHex } from "viem";

/**
 * The atom storing the current iframe resolving context
 */
export const iframeResolvingContextAtom = atom<
    IFrameResolvingContext | undefined
>(getIFrameResolvingContext());

/**
 * Simple hook to get the current resolving context
 */
export function useSafeResolvingContext() {
    const context = useAtomValue(iframeResolvingContextAtom);
    if (!context) {
        throw new Error("No resolving context available");
    }
    return context;
}

/**
 * The atom for the current handshake
 */
const handshakeTokensAtom = atom<Set<string>>(new Set<string>());

/**
 * Start to fetch the resolving context via an handshake
 */
export const startFetchResolvingContextViaHandshake = atom(
    null,
    (_get, set) => {
        // Generate an handshake token
        const token = crypto.randomUUID();
        // Set the token
        set(handshakeTokensAtom, (tokens) => tokens.add(token));
        // Emit the handshake event
        emitLifecycleEvent({
            iframeLifecycle: "handshake",
            data: { token },
        });
    }
);

/**
 * Handle the handshake response
 */
export const handleHandshakeResponse = atom(
    null,
    (get, set, event: MessageEvent<ClientLifecycleEvent>) => {
        if (
            event.data.clientLifecycle !== "handshake-response" ||
            !event.data?.data?.token
        ) {
            console.warn("Invalid handshake event type");
            return false;
        }

        // Extract the response token and ensure it match
        const responseToken = event.data.data.token;
        const tokens = get(handshakeTokensAtom);
        if (!tokens.has(responseToken)) {
            console.warn(`Invalid handshake token ${responseToken}`);
            return false;
        }

        // Set the new resolving context (only if different)
        const currentContext = get(iframeResolvingContextAtom);
        const context = getIFrameResolvingContext(event);
        if (currentContext?.sourceUrl !== context?.sourceUrl) {
            set(iframeResolvingContextAtom, context);
        }

        // Remove the token
        set(handshakeTokensAtom, (tokens) => {
            tokens.delete(responseToken);
            return tokens;
        });

        // Return the fresh context
        return true;
    }
);

/**
 * Get the current iFrame resolving context
 */
function getIFrameResolvingContext(
    event?: MessageEvent
): IFrameResolvingContext | undefined {
    if (typeof document === "undefined") {
        return undefined;
    }
    // Get the referrer of the iframe
    const sourceUrl = event?.origin ?? document?.referrer;
    if (!sourceUrl) {
        console.warn("No origin to compute resolving context", {
            sourceUrl,
        });
        return undefined;
    }

    // Map the origin to an url and compute the product id
    const originUrl = new URL(sourceUrl);
    const productId = keccak256(toHex(originUrl.hostname));
    const origin = originUrl.origin;
    console.debug("Computed resolving context", {
        sourceUrl,
        origin,
        productId,
    });

    // Return the context
    return { productId, origin, sourceUrl };
}
