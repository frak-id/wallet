import { useContext } from "react";
import { NexusConfigContext } from "../provider";

/**
 * Use the current nexus config
 */
export function useNexusConfig() {
    return useContext(NexusConfigContext);
}
