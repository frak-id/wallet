import {
    type ClientLifecycleEvent,
    FrakContextManager,
} from "@frak-labs/core-sdk";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { updateGlobalProperties } from "@frak-labs/wallet-shared/common/analytics";
import { sessionAtom } from "@frak-labs/wallet-shared/common/atoms/session";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/sdk/utils/lifecycleEvents";
import { atom, useAtomValue } from "jotai";
import { type Address, isAddressEqual, keccak256, toHex } from "viem";
import type { WalletRpcContext } from "../types/context";

type IFrameResolvingContext = Omit<WalletRpcContext, "source">;

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
export const startFetchResolvingContextViaHandshake = atom(null, (get, set) => {
    // Generate an handshake token
    const token = Math.random().toString(36).substring(2);
    // If we got more than 10 waiting tokens, don't do anything
    if (get(handshakeTokensAtom).size > 10) {
        console.warn("Too many handshake tokens without response, skipping");
        return;
    }
    // Set the token
    set(handshakeTokensAtom, (tokens) => tokens.add(token));
    // Emit the handshake event
    emitLifecycleEvent({
        iframeLifecycle: "handshake",
        data: { token },
    });
});

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
        const context = getIFrameResolvingContext(
            event as MessageEvent<
                Extract<
                    ClientLifecycleEvent,
                    { clientLifecycle: "handshake-response" }
                >
            >
        );
        if (
            currentContext?.sourceUrl !== context?.sourceUrl ||
            currentContext?.isAutoContext !== context?.isAutoContext
        ) {
            set(iframeResolvingContextAtom, context);

            // Set open panel global properties
            updateGlobalProperties({
                isIframe: true,
                productId: context?.productId,
                contextUrl: context?.sourceUrl,
                contextReferrer: context?.walletReferrer,
            });
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
    event?: MessageEvent<
        Extract<ClientLifecycleEvent, { clientLifecycle: "handshake-response" }>
    >
): IFrameResolvingContext | undefined {
    if (typeof document === "undefined") {
        return undefined;
    }
    // Get the referrer of the iframe
    const sourceUrl =
        event?.data?.data?.currentUrl ?? event?.origin ?? document?.referrer;
    if (!sourceUrl) {
        console.warn("No origin to compute resolving context", {
            sourceUrl,
        });
        return undefined;
    }

    // Map the origin to an url and compute the product id
    const originUrl = new URL(sourceUrl);
    const normalizedDomain = originUrl.host.replace("www.", "");
    const productId = keccak256(toHex(normalizedDomain));
    const origin = originUrl.origin;
    const walletReferrer = getWalletReferrer(sourceUrl);
    console.log("Computed resolving context", {
        sourceUrl,
        origin,
        productId,
        isAutoContext: event === undefined,
        ...(walletReferrer && { walletReferrer }),
    });

    // Return the context
    return {
        productId,
        origin,
        sourceUrl,
        isAutoContext: event === undefined,
        ...(walletReferrer && { walletReferrer }),
    };
}

/**
 * Get the referrer address from the source url
 * @param sourceUrl The source URL to extract the referrer from
 * @returns The referrer address if valid and different from current session, undefined otherwise
 */
function getWalletReferrer(sourceUrl: string): Address | undefined {
    // Get the current session
    const session = jotaiStore.get(sessionAtom);

    // Get the current frak context
    const frakContext = FrakContextManager.parse({
        url: sourceUrl,
    });

    // If we got a referrer and it's not the same as the current session, return it
    if (
        frakContext?.r &&
        (!session?.address || !isAddressEqual(frakContext.r, session.address))
    ) {
        return frakContext.r;
    }

    return;
}
