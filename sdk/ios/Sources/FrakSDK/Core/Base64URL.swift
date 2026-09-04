import Foundation

// base64url without padding (RFC 4648 §5). Backend never sees padding, so emitting
// any breaks parsing. Foundation's base64 accepts stray `+`/`/` and silently drops
// leftover bits at the end; both closed here to match the Kotlin decoder.
enum Base64URL {
    private static let alphabet = Set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    )

    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    // Nil (not throw) for invalid input, since callers parse untrusted links/params.
    static func decode(_ value: String) -> Data? {
        guard value.allSatisfy(alphabet.contains) else { return nil }
        // Remainder of 1 character cannot terminate a valid base64 group.
        let remainder = value.count % 4
        guard remainder != 1 else { return nil }
        let standard =
            value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = String(repeating: "=", count: remainder == 0 ? 0 : 4 - remainder)
        guard let decoded = Data(base64Encoded: standard + padding) else { return nil }
        // Round-trip check rejects leftover non-zero bits from an incomplete final byte.
        guard encode(decoded) == value else { return nil }
        return decoded
    }
}
