import { FrakRpcError, RpcErrorCodes } from "@frak-labs/core-sdk";
import { useContext } from "react";
import { FrakConfigContext } from "../provider";

/**
 * Use the current frak config
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
