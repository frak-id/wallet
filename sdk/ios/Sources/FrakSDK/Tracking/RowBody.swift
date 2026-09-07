import Foundation

/// The only place `Any` may appear in the tracking layer — see the payload note on `QueuedRow`.
enum RowBody {
    struct Built {
        let data: Data
        let fields: [String: Any]
    }

    /// Parses `payload`, injects `merchantId`, and re-serializes with `.sortedKeys`. Returns both
    /// the bytes about to be posted and the parsed fields, so a caller like the arrival guard
    /// reads the same parse that is about to go on the wire rather than parsing twice.
    ///
    /// Exact only because every payload value today is `String`, `Int64` or `[String: String]`; a
    /// `Double` would silently re-emit `12.0` as `12` — that is the trigger to move to typed payloads.
    static func withMerchantId(_ payload: String, merchantId: String) -> Built? {
        guard var object = try? JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any]
        else {
            return nil
        }
        object["merchantId"] = merchantId
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else {
            return nil
        }
        return Built(data: data, fields: object)
    }
}
