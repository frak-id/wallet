import { useContext } from "react";
import { NexusIFrameClientContext } from "../provider";

/**
 * Use the current nexus iframe client
 */
export function useNexusClient() {
    return useContext(NexusIFrameClientContext);
}
