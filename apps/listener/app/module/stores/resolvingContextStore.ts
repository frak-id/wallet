import {
    authenticatedBackendApi,
    clientIdStore,
    emitLifecycleEvent,
    updateGlobalProperties,
} from "@frak-labs/wallet-shared";
/**
 * Zustand store for iframe resolving context and handshake management
 */

import type { ClientLifecycleEvent } from "@frak-labs/core-sdk";
import { create } from "zustand";
import type { IFrameResolvingContext, ResolvingContextStore } from "./types";

/**
 * Read clientId from iframe URL query param (set by SDK at iframe creation).
 * Available from the very first line of code — no round-trip needed.
 */
const iframeClientId =
    typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("clientId") ??
          undefined)
        : undefined;

// Set clientId in store immediately at module load — before any async work.
// This ensures the x-frak-client-id header is available for the earliest API calls.
// Also re-set after persist rehydration to prevent stale localStorage values from
// overwriting the fresh URL param (race: sync setClientId vs async rehydration).
if (iframeClientId) {
    clientIdStore.getState().setClientId(iframeClientId);
    clientIdStore.persist.onFinishHydration(() => {
        clientIdStore.getState().setClientId(iframeClientId);
    });
}

/**
 * Cache for merchant lookups by domain
 */
const merchantCache = new Map<string, { merchantId: string }>();

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

            // Always update clientId from handshake — the SDK is the source of truth.
            // Previously guarded by !clientIdStore.getState().clientId, but a stale
            // rehydrated value would block fresh handshake updates.
            const handshakeClientId = event.data.data.clientId;
            if (handshakeClientId) {
                clientIdStore.getState().setClientId(handshakeClientId);
            }

            // Resolve context async (fetches merchantId from backend)
            // Token stays in handshakeTokens until resolution to block concurrent heartbeats
            resolveIFrameContext(
                event as MessageEvent<
                    Extract<
                        ClientLifecycleEvent,
                        { clientLifecycle: "handshake-response" }
                    >
                >
            ).then((context) => {
                // Token removal must happen after fetch to prevent heartbeat race condition
                set((state) => {
                    const newTokens = new Set(state.handshakeTokens);
                    newTokens.delete(responseToken);
                    return { handshakeTokens: newTokens };
                });

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
                        contextUrl: context.sourceUrl,
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
    const urlDomain = originUrl.host.replace("www.", "");
    const origin = originUrl.origin;
    const isAutoContext = event === undefined;
    const pendingMergeToken = event?.data?.data?.pendingMergeToken;

    // Prefer explicit config domain from SDK handshake over URL-derived domain
    // (handles proxied/tunneled environments like Shopify dev with Cloudflare tunnel)
    const configDomain = event?.data?.data?.configDomain;
    const normalizedDomain = configDomain?.replace(/^www\./, "") ?? urlDomain;

    // Fetch merchantId from backend (with cache)
    const merchantData = await fetchMerchantByDomain(normalizedDomain);

    console.log("Resolved context", {
        sourceUrl,
        origin,
        merchantId: merchantData.merchantId,
        isAutoContext,
        ...(iframeClientId && { clientId: iframeClientId }),
    });

    if (pendingMergeToken && iframeClientId && merchantData.merchantId) {
        authenticatedBackendApi.user.identity.merge.execute
            .post({
                mergeToken: pendingMergeToken,
                targetAnonymousId: iframeClientId,
                merchantId: merchantData.merchantId,
            })
            .catch((error) => {
                console.warn("Unable to merge client identities", error);
            });
    }

    return {
        merchantId: merchantData.merchantId,
        origin,
        sourceUrl,
        isAutoContext,
        ...(iframeClientId && { clientId: iframeClientId }),
    };
}

/**
 * Fetch merchant data from backend by domain
 * Always returns a result - falls back to empty merchantId if merchant not found
 */
async function fetchMerchantByDomain(
    domain: string
): Promise<{ merchantId: string }> {
    // Check cache first
    const cached = merchantCache.get(domain);
    if (cached) {
        return cached;
    }

    try {
        const { data, error } =
            await authenticatedBackendApi.user.merchant.resolve.get({
                query: { domain },
            });

        if (error || !data) {
            // Merchant not registered - use fallback
            console.warn(`Merchant not found for ${domain}, using fallback`);
            const fallback = { merchantId: "" };
            merchantCache.set(domain, fallback);
            return fallback;
        }

        const result = {
            merchantId: data.merchantId,
        };
        merchantCache.set(domain, result);
        return result;
    } catch (error) {
        console.warn("Failed to fetch merchant:", error);
        // Network error - use fallback
        const fallback = { merchantId: "" };
        merchantCache.set(domain, fallback);
        return fallback;
    }
}
