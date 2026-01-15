import {
    authenticatedBackendApi,
    emitLifecycleEvent,
    sessionStore,
    updateGlobalProperties,
} from "@frak-labs/wallet-shared";
/**
 * Zustand store for iframe resolving context and handshake management
 */

import {
    type ClientLifecycleEvent,
    FrakContextManager,
} from "@frak-labs/core-sdk";
import { type Address, type Hex, isAddressEqual, keccak256, toHex } from "viem";
import { create } from "zustand";
import type { IFrameResolvingContext, ResolvingContextStore } from "./types";

/**
 * Cache for merchant lookups by domain
 */
const merchantCache = new Map<string, { merchantId: string; productId: Hex }>();

/**
 * Clear the merchant cache (for testing)
 */
export function clearMerchantCache(): void {
    merchantCache.clear();
}

/**
 * Resolving context store
 */
export const resolvingContextStore = create<ResolvingContextStore>(
    (set, get) => ({
        // Initial state - will be populated async
        context: undefined,
        handshakeTokens: new Set<string>(),

        // Actions
        startHandshake: () => {
            // Generate an handshake token
            const token = Math.random().toString(36).substring(2);
            // If we got more than 10 waiting tokens, don't do anything
            if (get().handshakeTokens.size > 10) {
                console.warn(
                    "Too many handshake tokens without response, skipping"
                );
                return;
            }
            // Add the token
            set((state) => ({
                handshakeTokens: new Set(state.handshakeTokens).add(token),
            }));
            // Emit the handshake event
            emitLifecycleEvent({
                iframeLifecycle: "handshake",
                data: { token },
            });
        },

        handleHandshakeResponse: (
            event: MessageEvent<ClientLifecycleEvent>
        ) => {
            if (
                event.data.clientLifecycle !== "handshake-response" ||
                !event.data?.data?.token
            ) {
                console.warn("Invalid handshake event type");
                return false;
            }

            // Extract the response token and ensure it match
            const responseToken = event.data.data.token;
            const tokens = get().handshakeTokens;
            if (!tokens.has(responseToken)) {
                console.warn(`Invalid handshake token ${responseToken}`);
                return false;
            }

            // Remove the token first
            set((state) => {
                const newTokens = new Set(state.handshakeTokens);
                newTokens.delete(responseToken);
                return { handshakeTokens: newTokens };
            });

            // Resolve context async (fetches merchantId from backend)
            resolveIFrameContext(
                event as MessageEvent<
                    Extract<
                        ClientLifecycleEvent,
                        { clientLifecycle: "handshake-response" }
                    >
                >
            ).then((context) => {
                if (!context) return;

                const currentContext = get().context;
                if (
                    currentContext?.sourceUrl !== context.sourceUrl ||
                    currentContext?.isAutoContext !== context.isAutoContext
                ) {
                    set({ context });

                    // Set open panel global properties
                    updateGlobalProperties({
                        isIframe: true,
                        productId: context.productId,
                        contextUrl: context.sourceUrl,
                        contextReferrer: context.walletReferrer,
                    });
                }
            });

            // Return true to indicate token was valid
            return true;
        },

        setContext: (context) => set({ context }),
        clearContext: () => set({ context: undefined }),
    })
);

// Initialize context from document.referrer on load
if (typeof document !== "undefined" && document.referrer) {
    resolveIFrameContext().then((context) => {
        if (context) {
            resolvingContextStore.setState({ context });
        }
    });
}

/**
 * Resolve the iFrame context by fetching merchantId from backend
 */
async function resolveIFrameContext(
    event?: MessageEvent<
        Extract<ClientLifecycleEvent, { clientLifecycle: "handshake-response" }>
    >
): Promise<IFrameResolvingContext | undefined> {
    if (typeof document === "undefined") {
        return undefined;
    }

    // Get the referrer of the iframe
    const sourceUrl =
        event?.data?.data?.currentUrl ?? event?.origin ?? document?.referrer;
    if (!sourceUrl) {
        console.warn("No origin to compute resolving context", { sourceUrl });
        return undefined;
    }

    // Parse URL and get domain
    const originUrl = new URL(sourceUrl);
    const normalizedDomain = originUrl.host.replace("www.", "");
    const origin = originUrl.origin;
    const walletReferrer = getWalletReferrer(sourceUrl);
    const isAutoContext = event === undefined;

    // Fetch merchantId from backend (with cache)
    // Falls back to computed productId if merchant not found
    const merchantData = await fetchMerchantByDomain(normalizedDomain);

    console.log("Resolved context", {
        sourceUrl,
        origin,
        merchantId: merchantData.merchantId,
        productId: merchantData.productId,
        isAutoContext,
        ...(walletReferrer && { walletReferrer }),
    });

    return {
        merchantId: merchantData.merchantId,
        productId: merchantData.productId,
        origin,
        sourceUrl,
        isAutoContext,
        ...(walletReferrer && { walletReferrer }),
    };
}

/**
 * Fetch merchant data from backend by domain
 * Always returns a result - falls back to computed productId if merchant not found
 */
async function fetchMerchantByDomain(
    domain: string
): Promise<{ merchantId: string; productId: Hex }> {
    // Check cache first
    const cached = merchantCache.get(domain);
    if (cached) {
        return cached;
    }

    // Compute fallback productId (used if backend lookup fails)
    const fallbackProductId = keccak256(toHex(domain));

    try {
        const { data, error } =
            await authenticatedBackendApi.user.merchant.resolve.get({
                query: { domain },
            });

        if (error || !data) {
            // Merchant not registered - use fallback
            console.warn(`Merchant not found for ${domain}, using fallback`);
            const fallback = { merchantId: "", productId: fallbackProductId };
            merchantCache.set(domain, fallback);
            return fallback;
        }

        const result = {
            merchantId: data.merchantId,
            productId: data.productId as Hex,
        };
        merchantCache.set(domain, result);
        return result;
    } catch (error) {
        console.warn("Failed to fetch merchant:", error);
        // Network error - use fallback
        const fallback = { merchantId: "", productId: fallbackProductId };
        merchantCache.set(domain, fallback);
        return fallback;
    }
}

/**
 * Get the referrer address from the source url
 * @param sourceUrl The source URL to extract the referrer from
 * @returns The referrer address if valid and different from current session, undefined otherwise
 */
function getWalletReferrer(sourceUrl: string): Address | undefined {
    // Get the current session from store
    const session = sessionStore.getState().session;

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
