import type { StartArticleUnlockReturnType } from "../../types";
import type { KeyProvider } from "../../types/compression";
import type { RedirectRpcSchema } from "../../types/rpc";
import { InternalError, MethodNotFoundError } from "../../types/rpc/error";
import type { ExtractedParametersFromRpc } from "../../types/transport";

/**
 * Get the right request key provider for the given args
 * @param args
 */
export const redirectRequestKeyProvider: KeyProvider<
    ExtractedParametersFromRpc<RedirectRpcSchema>
> = (args: ExtractedParametersFromRpc<RedirectRpcSchema>) => {
    // Start unlock options key
    if (args.method === "frak_startArticleUnlock") {
        return [
            "start-unlock",
            args.params.contentId,
            args.params.articleId,
            args.params.price.index.toString(),
        ];
    }

    // Not found
    throw new MethodNotFoundError(
        `Method not found ${args.method}`,
        args.method
    );
};

type RedirectRpcResponseKeyProvider<
    TMethod extends ExtractedParametersFromRpc<RedirectRpcSchema>["method"],
> = KeyProvider<
    Extract<RedirectRpcSchema[number], { Method: TMethod }>["ReturnType"]
>;

/**
 * Get the right response key provider for the given redirect method
 * @param method
 */
export function getRedirectResponseResponseKeyProvider<
    TMethod extends ExtractedParametersFromRpc<RedirectRpcSchema>["method"],
>(method: TMethod): RedirectRpcResponseKeyProvider<TMethod> {
    // Unlock options key
    if (method === "frak_startArticleUnlock") {
        return ((response: StartArticleUnlockReturnType) => [
            "start-unlock",
            response.key,
            response.status,
            response.user ?? "0xdeadbeef",
        ]) as RedirectRpcResponseKeyProvider<TMethod>;
    }

    throw new InternalError(`No key provider found for the request ${method}`);
}
