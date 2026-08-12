type NestedStringRecord = { [key: string]: NestedStringRecord | string };

/**
 * Segments that would let a key path escape the accumulator and write onto
 * `Object.prototype`. Keys reach here from merchant config and, on the listener,
 * from the embedding page.
 */
const UNSAFE_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Convert a translation key path to an object
 *  -> { "key1.text": "value1", "key1.title": "value2", "key2.text": "value3" } -> { "key1": { "text": "value1", "title": "value2" }, "key2": { "text": "value3" } }
 */
export function translationKeyPathToObject(translation: object) {
    return Object.entries(translation).reduce(
        (acc: NestedStringRecord, [key, value]) => {
            const parts = key.split(".");
            if (parts.some((part) => UNSAFE_SEGMENTS.has(part))) return acc;

            let current = acc;

            // Handle all parts except the last one
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const existing = current[part];
                // A path may cross a leaf a shallower key already wrote; overwrite it
                // rather than walking into a string.
                current[part] =
                    typeof existing === "object" && existing !== null
                        ? existing
                        : {};
                current = current[part] as NestedStringRecord;
            }

            // Set the value at the deepest level
            const lastPart = parts[parts.length - 1];
            current[lastPart] = value;

            return acc;
        },
        {}
    );
}
