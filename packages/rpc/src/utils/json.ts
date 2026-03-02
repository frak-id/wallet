/**
 * Encode data as JSON and convert to Uint8Array
 * @param data - Data to encode
 * @returns Uint8Array of JSON-encoded data
 */
export function jsonEncode(data: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(data));
}

/**
 * Decode Uint8Array as JSON
 * @param data - Uint8Array to decode
 * @returns Parsed data or null if decoding fails
 */
export function jsonDecode<T>(data: Uint8Array): T | null {
    try {
        return JSON.parse(new TextDecoder().decode(data)) as T;
    } catch {
        return null;
    }
}
