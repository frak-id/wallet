import { onDocumentReady } from "@frak-labs/shared/module/utils/onDocumentReady";
import { websiteOverrides } from "./specifics";

export * from "../core/index";
export * from "../core/actions";
export * from "../core/interactions";

// Run website specific overrides
onDocumentReady(() => websiteOverrides());
