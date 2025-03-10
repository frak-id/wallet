import { onDocumentReady } from "@shared/module/utils/onDocumentReady";
import type { ComponentType } from "preact";
import register from "preact-custom-element";
import { initFrakSdk } from "./initFrakSdk";

/**
 * Registers a Preact component as a custom web component
 *
 * @param component - The Preact component to register
 * @param tagName - The custom element tag name (e.g., "frak-button-wallet")
 * @param observedAttributes - Array of attribute names to observe for changes
 * @param options - Registration options (e.g., { shadow: false })
 */
export function registerWebComponent<P>(
    component: ComponentType<P>,
    tagName: string,
    observedAttributes: string[] = [],
    options: { shadow: boolean } = { shadow: false }
): void {
    if (typeof window !== "undefined") {
        // Initialize SDK when document is ready
        onDocumentReady(async function initComponent() {
            await initFrakSdk();
        });

        // Register the component if not already registered
        if (!customElements.get(tagName)) {
            register(component, tagName, observedAttributes, options);
        }
    }
}
