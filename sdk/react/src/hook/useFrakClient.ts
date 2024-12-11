import { useContext } from "react";
import { FrakIFrameClientContext } from "../provider";

/**
 * Use the current frak iframe client
 */
export function useFrakClient() {
    return useContext(FrakIFrameClientContext);
}
