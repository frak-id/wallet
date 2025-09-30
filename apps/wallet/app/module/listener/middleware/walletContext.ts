import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { RpcErrorCodes } from "@frak-labs/core-sdk";
import { FrakRpcError } from "@frak-labs/rpc";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { keccak256, toHex } from "viem";

/**
 * Wallet context augmentation middleware
 *
 * Reads the iframe resolving context from Jotai store ONCE per request
 * and augments the RPC context with wallet-specific fields.
 *
 * This centralizes:
 * - Reading from iframeResolvingContextAtom
 * - ProductId validation against message origin
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
 *   // context.productId, context.sourceUrl, etc. are directly available
 *   // No need to read from store!
 * })
 * ```
 */
export const walletContextMiddleware = {
    onRequest: <
        TContext extends { origin: string; source: MessageEventSource | null },
    >(
        message: unknown,
        context: TContext
    ): TContext & WalletRpcContext => {
        const msg = message as { topic: string };
        // Read resolving context from Jotai store (only once per request)
        const resolvingContext = jotaiStore.get(iframeResolvingContextAtom);

        // If no resolving context is available, reject the request
        if (!resolvingContext) {
            throw new FrakRpcError(
                RpcErrorCodes.configError,
                "No resolving context available - handshake may be required"
            );
        }

        // Compute productId from message origin for validation
        // This ensures the request is from the expected domain
        const normalizedDomain = new URL(context.origin).host.replace(
            "www.",
            ""
        );
        const computedProductId = keccak256(toHex(normalizedDomain));

        // Validate that computed productId matches the stored context
        // This prevents cross-domain attacks
        if (BigInt(computedProductId) !== BigInt(resolvingContext.productId)) {
            console.error("Mismatching product id, rejecting RPC request", {
                computedProductId,
                storedProductId: resolvingContext.productId,
                origin: context.origin,
                method: msg.topic,
            });

            // In local development, allow mismatch for testing
            if (!isRunningLocally) {
                throw new FrakRpcError(
                    RpcErrorCodes.configError,
                    "Product ID mismatch - origin does not match expected domain"
                );
            }
        }

        // Augment context with wallet-specific fields
        // Handlers can now access these fields directly from context parameter
        return {
            ...context,
            productId: resolvingContext.productId,
            sourceUrl: resolvingContext.sourceUrl,
            isAutoContext: resolvingContext.isAutoContext,
            walletReferrer: resolvingContext.walletReferrer,
        };
    },
} as const;
