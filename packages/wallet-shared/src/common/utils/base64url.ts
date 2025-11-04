/**
 * Convert an ArrayBuffer to a base64url-encoded string
 */
export function bufferToBase64URLString(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

/**
 * Convert a base64url-encoded string to an ArrayBuffer
 */
export function base64URLStringToBuffer(base64url: string): ArrayBuffer {
    // Convert base64url to base64
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");

    // Decode base64 string
    const binary = atob(base64);

    // Convert to ArrayBuffer
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
}
