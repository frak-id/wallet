import { useContext } from "react";
import { NexusIFrameClientContext } from "../provider";

/**
 * Use the current nexus iframe client
 */
export function useNexusClient() {
    const client = useContext(NexusIFrameClientContext);
    if (!client) {
        throw new Error("NexusIFrameClientProvider is not found");
    }
    return client;
}
