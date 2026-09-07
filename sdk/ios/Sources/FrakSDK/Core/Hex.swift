import Foundation

/// Lowercase hex, both directions. Shared by the identity proof layout and the
/// FrakContext v2 codec, which both read and emit raw bytes as hex text.
enum Hex {
    private static let digits = Array("0123456789abcdef")

    static func encode(_ bytes: some Sequence<UInt8>) -> String {
        var out = ""
        for byte in bytes {
            out.append(digits[Int(byte >> 4)])
            out.append(digits[Int(byte & 0x0F)])
        }
        return out
    }

    /// Nil on an odd length or any non-hex character.
    static func decode(_ value: String) -> Data? {
        let characters = Array(value.utf8)
        guard characters.count % 2 == 0 else { return nil }
        var bytes = Data(capacity: characters.count / 2)
        for index in stride(from: 0, to: characters.count, by: 2) {
            guard let high = nibble(characters[index]), let low = nibble(characters[index + 1]) else { return nil }
            bytes.append(high << 4 | low)
        }
        return bytes
    }

    /// The value of one ASCII hex digit, or nil.
    static func nibble(_ byte: UInt8) -> UInt8? {
        switch byte {
        case UInt8(ascii: "0")...UInt8(ascii: "9"): byte - UInt8(ascii: "0")
        case UInt8(ascii: "a")...UInt8(ascii: "f"): byte - UInt8(ascii: "a") + 10
        case UInt8(ascii: "A")...UInt8(ascii: "F"): byte - UInt8(ascii: "A") + 10
        default: nil
        }
    }
}
