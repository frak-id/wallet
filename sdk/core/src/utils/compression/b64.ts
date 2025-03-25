export function base64urlEncode(buffer: Uint8Array): string {
    return btoa(Array.from(buffer, (b) => String.fromCharCode(b)).join(""))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function base64urlDecode(value: string): Uint8Array {
    const m = value.length % 4;
    return Uint8Array.from(
        atob(
            value
                .replace(/-/g, "+")
                .replace(/_/g, "/")
                .padEnd(value.length + (m === 0 ? 0 : 4 - m), "=")
        ),
        (c) => c.charCodeAt(0)
    );
}
