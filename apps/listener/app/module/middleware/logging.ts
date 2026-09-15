import { isRunningLocally } from "@frak-labs/app-essentials/utils/env";
import type {
    RpcMiddleware,
    RpcMiddlewareContext,
    RpcResponse,
} from "@frak-labs/frame-connector";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/types/context";

/**
 * Logs RPC requests and responses, in local development only.
 */
export const loggingMiddleware: RpcMiddleware<
    CombinedRpcSchema,
    WalletRpcContext
> = {
    onRequest: (message, context): RpcMiddlewareContext<WalletRpcContext> => {
        const msg = message as { id: string; topic: string; data: unknown };
        if (!isRunningLocally) {
            return context;
        }

        console.log("[Wallet RPC] Request:", {
            topic: msg.topic,
            origin: context.origin,
            id: msg.id,
            hasData: msg.data,
        });

        return context;
    },

    onResponse: (message, response, context): RpcResponse => {
        const msg = message as { id: string; topic: string };
        if (!isRunningLocally) {
            return response;
        }

        if (response.error) {
            console.error("[Wallet RPC] Error response:", {
                topic: msg.topic,
                origin: context.origin,
                id: msg.id,
                error: response.error,
            });
        } else {
            console.log("[Wallet RPC] Success response:", {
                topic: msg.topic,
                origin: context.origin,
                id: msg.id,
                hasResult: response.result,
            });
        }

        return response;
    },
};
