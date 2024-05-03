import type {
    ArticleUnlockStatusReturnType,
    ExtractedParametersFromRpc,
    ExtractedReturnTypeFromRpc,
    IFrameRpcSchema,
    KeyProvider,
    SetUserReferredReturnType,
    UnlockOptionsReturnType,
    WalletStatusReturnType,
} from "../../types";

/**
 * Get the right request key provider for the given args
 * @param args
 */
export const iFrameRequestKeyProvider: KeyProvider<
    ExtractedParametersFromRpc<IFrameRpcSchema>
> = (args: ExtractedParametersFromRpc<IFrameRpcSchema>) => {
    // Unlock options key
    if (args.method === "frak_getArticleUnlockOptions") {
        return ["get-price", args.params[0], args.params[1]];
    }

    // Wallet status key
    if (args.method === "frak_listenToWalletStatus") {
        return ["wallet-status"];
    }

    // Article unlock status key
    if (args.method === "frak_listenToArticleUnlockStatus") {
        return ["article-unlock-status", args.params[0], args.params[1]];
    }

    // Referred user key
    if (args.method === "frak_listenToSetUserReferred") {
        return ["user-referred", args.params[0], args.params[1]];
    }

    // Not found
    throw new Error(`No key provider found for the arguments ${args}`);
};

type RpcResponseKeyProvider<
    TParameters extends Pick<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        "method"
    >,
> = KeyProvider<
    ExtractedReturnTypeFromRpc<
        IFrameRpcSchema,
        Extract<
            ExtractedParametersFromRpc<IFrameRpcSchema>,
            { method: TParameters["method"] }
        >
    >
>;

/**
 * Get the right response key provider for the given param
 * @param param
 */
export function getIFrameResponseKeyProvider<
    TParameters extends Pick<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        "method"
    >,
>(param: TParameters): RpcResponseKeyProvider<TParameters> {
    // Unlock options key
    if (param.method === "frak_getArticleUnlockOptions") {
        return ((response: UnlockOptionsReturnType) => [
            "get-price-response",
            response.prices.length,
        ]) as RpcResponseKeyProvider<TParameters>;
    }

    // Wallet status key
    if (param.method === "frak_listenToWalletStatus") {
        return ((response: WalletStatusReturnType) => [
            "wallet-status",
            response.key,
            response.key === "connected" ? response.wallet : "0xdeadbeef",
        ]) as RpcResponseKeyProvider<TParameters>;
    }

    // Wallet status key
    if (param.method === "frak_listenToArticleUnlockStatus") {
        return ((response: ArticleUnlockStatusReturnType) => [
            "article-unlock-status",
            response.key,
            response.key === "valid"
                ? response.allowedUntil.toString(16)
                : "deadbeef",
        ]) as RpcResponseKeyProvider<TParameters>;
    }

    // Referred user key
    if (param.method === "frak_listenToSetUserReferred") {
        return ((response: SetUserReferredReturnType) => [
            "user-referred",
            response.key,
        ]) as RpcResponseKeyProvider<TParameters>;
    }

    throw new Error(`No key provider found for the request ${param}`);
}
