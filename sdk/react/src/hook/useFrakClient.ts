import { useContext } from "react";
import { FrakIFrameClientContext } from "../provider";

/**
 * Get the current Frak client
 *
 * @group hooks
 */
export function useFrakClient() {
    return useContext(FrakIFrameClientContext);
}
