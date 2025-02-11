import { createIFrameFrakClient } from "@frak-labs/core-sdk";
import { onDocumentReady } from "@module/utils/onDocumentReady";
import { websiteOverrides } from "./specifics";

/**
 * This whole script is only a flat pass to the newer SDK versions
 */

export * from "@frak-labs/core-sdk";
export * from "@frak-labs/core-sdk/actions";
export * from "@frak-labs/core-sdk/interactions";

// Export old `createIFrameNexusClient` to be retro compatible
export const createIFrameNexusClient = createIFrameFrakClient;

// Run website specific overrides
onDocumentReady(() => websiteOverrides());
