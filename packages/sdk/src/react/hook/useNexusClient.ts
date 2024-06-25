import { useContext } from "react";
import { NexusIFrameClientContext } from "../provider";

/**
 * Use the current nexus iframe client
 */
export function useNexusClient() {
    const client = useContext(NexusIFrameClientContext);
    if (!client) {
        console.error("NexusIFrameClientProvider is not found");
        return;
    }
    return client;
}
