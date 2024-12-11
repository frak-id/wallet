import { FrakRpcError, RpcErrorCodes } from "@frak-labs/core-sdk";
import { useContext } from "react";
import { NexusConfigContext } from "../provider";

/**
 * Use the current nexus config
 */
export function useNexusConfig() {
    const config = useContext(NexusConfigContext);
    if (!config) {
        throw new FrakRpcError(
            RpcErrorCodes.configError,
            "Nexus config not found"
        );
    }
    return config;
}
