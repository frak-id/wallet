import Foundation

// RFC 3986 percent-encoding for a single query-string value. Not `.urlQueryAllowed`,
// which leaves `&`, `=`, `+` alone. Public (not merchant-facing) so FrakSDKUI can reuse it.
public enum PercentEncoding {
    private static let unreserved = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    )

    public static func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
    }
}
