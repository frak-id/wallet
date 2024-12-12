import { createIFrameFrakClient } from "@core/clients";
import { onDocumentReady } from "@module/utils/onDocumentReady";
import { websiteOverrides } from "./specifics";

/**
 * This whole script is only a flat pass to the newer SDK versions
 */

export * from "@core/index";
export * from "@core/actions";
export * from "@core/interactions";

// Export old `createIFrameNexusClient` to be retro compatible
export const createIFrameNexusClient = createIFrameFrakClient;

// Run website specific overrides
onDocumentReady(() => websiteOverrides());
