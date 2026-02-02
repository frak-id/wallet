import { isRunningLocally } from "@frak-labs/app-essentials";
import {
    FrakRpcError,
    RpcErrorCodes,
    type RpcMiddleware,
} from "@frak-labs/frame-connector";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/types/context";

/**
 * Wallet context augmentation middleware
 *
 * Reads the iframe resolving context from Zustand store ONCE per request
 * and augments the RPC context with wallet-specific fields.
 *
 * This centralizes:
 * - Reading from resolvingContextStore
 * - Origin validation against stored context
 * - Context availability checks
 *
 * Performance impact: Reduces store reads from N (one per handler) to 1 per request
 *
 * @example
 * ```ts
 * const listener = createRpcListener<IFrameRpcSchema, WalletRpcContext>({
 *   transport: window,
 *   allowedOrigins: '*',
 *   middleware: [walletContextMiddleware]
 * })
 *
 * // Handlers now receive augmented context
 * listener.handle('frak_sendInteraction', async (params, context) => {
 *   // context.merchantId, context.sourceUrl, etc. are directly available
 *   // No need to read from store!
 * })
 * ```
 */
export const walletContextMiddleware: RpcMiddleware<
    CombinedRpcSchema,
    WalletRpcContext
> = {
    onRequest: (message, context) => {
        const msg = message as { topic: string };
        // Read resolving context from Zustand store (only once per request)
        const resolvingContext = resolvingContextStore.getState().context;

        // If no resolving context is available, reject the request
        if (!resolvingContext) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "No resolving context available - handshake may be required"
            );
        }

        if (context.origin === window.origin) {
            console.debug(
                "Received message from another wallet window, skipping context check",
                message,
                context
            );
            return {
                ...context,
                merchantId: "",
                sourceUrl: context.origin,
                isAutoContext: false,
                clientId: resolvingContext.clientId,
            };
        }

        // Validate origin matches the stored context origin
        // This prevents cross-domain attacks
        const normalizedRequestOrigin = new URL(context.origin).origin;
        const normalizedStoredOrigin = resolvingContext.origin;

        if (normalizedRequestOrigin !== normalizedStoredOrigin) {
            console.error("Origin mismatch, rejecting RPC request", {
                requestOrigin: normalizedRequestOrigin,
                storedOrigin: normalizedStoredOrigin,
                method: msg.topic,
            });

            // In local development, allow mismatch for testing
            if (!isRunningLocally) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "Origin mismatch - request origin does not match expected domain"
                );
            }
        }

        // Augment context with wallet-specific fields
        // Handlers can now access these fields directly from context parameter
        return {
            ...context,
            merchantId: resolvingContext.merchantId,
            sourceUrl: resolvingContext.sourceUrl,
            isAutoContext: resolvingContext.isAutoContext,
            walletReferrer: resolvingContext.walletReferrer,
            clientId: resolvingContext.clientId,
        };
    },
} as const;
