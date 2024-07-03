import { useContext } from "react";
import { NexusConfigContext } from "../provider";
import {FrakRpcError, RpcErrorCodes} from "../../core";

/**
 * Use the current nexus config
 */
export function useNexusConfig() {
    const config =  useContext(NexusConfigContext);
    if (!config) {
        throw new FrakRpcError(RpcErrorCodes.configError, "Nexus config not found");
    }
    return config;
}
