import type {
    ArticleUnlockStatusReturnType,
    ExtractedParametersFromRpc,
    ExtractedReturnTypeFromRpc,
    IFrameRpcSchema,
    KeyProvider,
    SendInteractionReturnType,
    SendTransactionReturnType,
    SiweAuthenticateReturnType,
    UnlockOptionsReturnType,
    WalletStatusReturnType,
} from "../../types";
import { InternalError, MethodNotFoundError } from "../../types/rpc/error";

/**
 * Get the right request key provider for the given args
 * @param args
 */
export const iFrameRequestKeyProvider: KeyProvider<
    ExtractedParametersFromRpc<IFrameRpcSchema>
> = (args: ExtractedParametersFromRpc<IFrameRpcSchema>) => {
    const method = args.method;
    switch (args.method) {
        // Unlock options key
        case "frak_getArticleUnlockOptions":
            return ["get-price", args.params[0], args.params[1]];

        // Wallet status key
        case "frak_listenToWalletStatus":
            return ["wallet-status"];

        // Article unlock status key
        case "frak_listenToArticleUnlockStatus":
            return ["article-unlock-status", args.params[0], args.params[1]];

        // Send transaction
        case "frak_sendTransaction":
            return ["send-transaction", JSON.stringify(args.params[0])];

        // Send interaction
        case "frak_sendInteraction":
            return [
                "send-interaction",
                args.params[0],
                JSON.stringify(args.params[1]),
            ];

        // Siwe authentication
        case "frak_siweAuthenticate":
            return ["siwe-authentication", JSON.stringify(args.params[0])];

        default:
            throw new MethodNotFoundError(`Method not found ${method}`, method);
    }
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
    switch (param.method) {
        // Article unlock options
        case "frak_getArticleUnlockOptions":
            return ((response: UnlockOptionsReturnType) => [
                "get-price-response",
                response.prices.length,
            ]) as RpcResponseKeyProvider<TParameters>;

        // Wallet status
        case "frak_listenToWalletStatus":
            return ((response: WalletStatusReturnType) => [
                "wallet-status",
                response.key,
                response.key === "connected" ? response.wallet : "0xdeadbeef",
            ]) as RpcResponseKeyProvider<TParameters>;

        // Article unlock status
        case "frak_listenToArticleUnlockStatus":
            return ((response: ArticleUnlockStatusReturnType) => [
                "article-unlock-status",
                response.key,
                response.key === "valid"
                    ? response.allowedUntil.toString(16)
                    : "deadbeef",
            ]) as RpcResponseKeyProvider<TParameters>;

        // Send transaction
        case "frak_sendTransaction":
            return ((response: SendTransactionReturnType) => [
                "send-transaction",
                response.key,
                response.key === "success" ? response.hash : "0xdeadbeef",
            ]) as RpcResponseKeyProvider<TParameters>;

        // Send interaction
        case "frak_sendInteraction":
            return ((response: SendInteractionReturnType) => [
                "send-interaction",
                response.key,
                response.key === "success" ? response.hash : "0xdeadbeef",
            ]) as RpcResponseKeyProvider<TParameters>;

        // Siwe authentication
        case "frak_siweAuthenticate":
            return ((response: SiweAuthenticateReturnType) => [
                "siwe-authentication",
                response.key,
                response.key === "success" ? response.signature : "0xdeadbeef",
            ]) as RpcResponseKeyProvider<TParameters>;

        default:
            throw new InternalError(
                `No key provider found for the request ${param}`
            );
    }
}
