import { FrakRpcError, RpcErrorCodes } from "@frak-labs/core-sdk";
import { useContext } from "react";
import { FrakConfigContext } from "../provider";

/**
 * Get the current Frak config
 * @throws {FrakRpcError} if the config is not found (only if this hooks is used outside of a FrakConfigProvider)
 * @group hooks
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
