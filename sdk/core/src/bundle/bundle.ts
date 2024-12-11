import { onDocumentReady } from "@module/utils/onDocumentReady";
import { websiteOverrides } from "./specifics";

export * from "../index.ts";
export * from "../actions";
export * from "../interactions";

// Run website specific overrides
onDocumentReady(() => websiteOverrides());
