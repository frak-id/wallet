export async function loadPolyfills() {
    if (typeof Array.prototype.at !== "function") {
        try {
            // @ts-ignore
            await import("core-js/features/array/at");
        } catch (err) {
            console.error("Failed to load Array.at polyfill:", err);
        }
    }
    if (typeof Object.hasOwn !== "function") {
        try {
            // @ts-ignore
            await import("core-js/es/object/has-own");
        } catch (err) {
            console.error("Failed to load Object.hasOwn polyfill:", err);
        }
    }
}
