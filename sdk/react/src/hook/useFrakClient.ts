import type { FrakClient } from "@frak-labs/core-sdk";
import { useContext } from "react";
import { FrakIFrameClientContext } from "../provider";

/**
 * Get the current Frak client
 *
 * @group hooks
 */
export function useFrakClient(): FrakClient | undefined {
    return useContext(FrakIFrameClientContext);
}
