import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { useContext } from "react";
import { FrakConfigContext } from "../provider";

/**
 * Get the current Frak config
 * @throws {FrakRpcError} if the config is not found (only if this hooks is used outside a FrakConfigProvider)
 * @group hooks
 *
 * @see {@link @frak-labs/react-sdk!FrakConfigProvider | FrakConfigProvider} for the config provider
 * @see {@link @frak-labs/core-sdk!index.FrakWalletSdkConfig | FrakWalletSdkConfig} for the config type
 */
export function useFrakConfig() {
    const config = useContext(FrakConfigContext);
    if (!config) {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "Frak config not found"
        );
    }
    return config;
}
