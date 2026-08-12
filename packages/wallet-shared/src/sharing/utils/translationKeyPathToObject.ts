type NestedStringRecord = { [key: string]: NestedStringRecord | string };

/**
 * Convert a translation key path to an object
 *  -> { "key1.text": "value1", "key1.title": "value2", "key2.text": "value3" } -> { "key1": { "text": "value1", "title": "value2" }, "key2": { "text": "value3" } }
 */
export function translationKeyPathToObject(translation: object) {
    return Object.entries(translation).reduce(
        (acc: NestedStringRecord, [key, value]) => {
            const parts = key.split(".");
            let current = acc;

            // Handle all parts except the last one
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                current[part] = current[part] || {};
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
