import { onDocumentReady } from "@module/utils/onDocumentReady";
import { websiteOverrides } from "./specifics";

export * from "../index";
export * from "../actions";
export * from "../interactions";

// Run website specific overrides
onDocumentReady(() => websiteOverrides());
