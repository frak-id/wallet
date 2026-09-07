import Foundation

/// Minimal query-string editing over a URL string. Not `URLComponents`, which cannot edit one
/// parameter without re-serialising the whole query through an encoder that re-encodes what is
/// already encoded — and a merchant's published links must not change under them. One exception,
/// which no server distinguishes: an empty value loses its `=`, so `?a=&b=1` round-trips as
/// `?a&b=1`.
struct URLQuery {
    private let base: String
    private let fragment: String
    private var parameters: [(key: String, value: String)]

    /// Nil when `url` has no scheme separator — anything else is treated as an opaque base.
    static func parse(_ url: String) -> URLQuery? {
        guard url.contains("://") else { return nil }

        let withoutFragment: Substring
        let fragment: Substring
        if let hash = url.firstIndex(of: "#") {
            withoutFragment = url[url.startIndex..<hash]
            fragment = url[hash...]
        } else {
            withoutFragment = url[...]
            fragment = ""
        }

        let base: Substring
        let query: Substring
        if let mark = withoutFragment.firstIndex(of: "?") {
            base = withoutFragment[withoutFragment.startIndex..<mark]
            query = withoutFragment[withoutFragment.index(after: mark)...]
        } else {
            base = withoutFragment
            query = ""
        }

        let parameters = query.split(separator: "&").map { part -> (key: String, value: String) in
            guard let separator = part.firstIndex(of: "=") else { return (String(part), "") }
            return (String(part[part.startIndex..<separator]), String(part[part.index(after: separator)...]))
        }

        return URLQuery(base: String(base), fragment: String(fragment), parameters: parameters)
    }

    /// The decoded value at `key`, or nil. Case-folded because channels lowercase query keys in
    /// transit, but an exact match wins, so `?fctx=stale&fCtx=real` resolves to `real`. The value
    /// is percent-decoded because a channel that re-encodes a link turns `-` into `%2D` and the
    /// base64url payload would then fail to decode. Mirrors `utils/url/queryParams.ts`.
    func value(for key: String) -> String? {
        let match =
            parameters.first { $0.key == key }
            ?? parameters.first { $0.key.caseInsensitiveCompare(key) == .orderedSame }
        return match.map { Self.percentDecode($0.value) }
    }

    /// Exact-key lookup, for parameters the web client reads through `URLSearchParams.get`. `fCtx`
    /// tolerates mangled casing; `fmt` authorises an identity merge, so it matches web or not at all.
    func exactValue(for key: String) -> String? {
        parameters.first { $0.key == key }.map { Self.percentDecode($0.value) }
    }

    mutating func remove(_ key: String) {
        parameters.removeAll { $0.key.caseInsensitiveCompare(key) == .orderedSame }
    }

    /// Appends `key` only when it is absent — gap-fill, so a merchant's own value always wins.
    mutating func fillIfAbsent(_ key: String, _ value: String?) {
        guard let value, !value.isEmpty, self.value(for: key) == nil else { return }
        parameters.append((key, PercentEncoding.encode(value)))
    }

    /// Replaces `key`, appending it so ordering stays position-independent.
    mutating func set(_ key: String, to value: String) {
        remove(key)
        parameters.append((key, PercentEncoding.encode(value)))
    }

    var string: String {
        var out = base
        for (index, parameter) in parameters.enumerated() {
            out += index == 0 ? "?" : "&"
            out += parameter.key
            if !parameter.value.isEmpty {
                out += "=" + parameter.value
            }
        }
        return out + fragment
    }

    /// Tolerant by design: a malformed escape is left as written rather than dropping the value.
    /// `+` decodes to a space, as `URLSearchParams` does, so a merchant's own link reads the same
    /// here as it does on the web.
    static func percentDecode(_ value: String) -> String {
        guard value.contains("%") || value.contains("+") else { return value }
        let characters = Array(value.utf8)
        var bytes: [UInt8] = []
        bytes.reserveCapacity(characters.count)
        var index = 0
        while index < characters.count {
            if characters[index] == UInt8(ascii: "%"), index + 2 < characters.count,
                let high = Hex.nibble(characters[index + 1]), let low = Hex.nibble(characters[index + 2])
            {
                bytes.append(high << 4 | low)
                index += 3
            } else if characters[index] == UInt8(ascii: "+") {
                bytes.append(UInt8(ascii: " "))
                index += 1
            } else {
                bytes.append(characters[index])
                index += 1
            }
        }
        return String(decoding: bytes, as: UTF8.self)
    }
}
