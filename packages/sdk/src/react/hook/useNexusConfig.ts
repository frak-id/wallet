import { useContext } from "react";
import { NexusConfigContext } from "../provider";

/**
 * Use the current nexus config
 */
export function useNexusConfig() {
    const config = useContext(NexusConfigContext);
    if (!config) {
        throw new Error("NexusConfigProvider is not found");
    }
    return config;
}
