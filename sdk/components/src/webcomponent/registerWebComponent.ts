import type { ComponentType } from "preact";
import register from "preact-custom-element";
import { initFrakSdk } from "../bootstrap/initFrakSdk";
import { onDocumentReady } from "../utils/browser/onDocumentReady";

/**
 * Registers a Preact component as a custom web component
 *
 * @param component - The Preact component to register
 * @param tagName - The custom element tag name (e.g., "frak-button-wallet")
 * @param observedAttributes - Array of attribute names to observe for changes
 * @param options - Registration options (e.g., { shadow: true })
 */
export function registerWebComponent<P>(
    component: ComponentType<P>,
    tagName: string,
    observedAttributes: (keyof P)[] = [],
    options: { shadow: boolean } = { shadow: true }
): void {
    if (typeof window !== "undefined") {
        // Initialize SDK when document is ready
        onDocumentReady(initFrakSdk);

        // Register the component if not already registered
        if (!customElements.get(tagName)) {
            const names = observedAttributes.map(String);
            // HTML lowercases attribute names, so a camelCase entry never
            // matches one: observe the dash-case form too.
            const dashed = names
                .map((n) => n.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
                .filter((n) => !names.includes(n));
            const observed = [...names, ...dashed] as (keyof P)[];
            register(component, tagName, observed, options);
        }
    }
}
