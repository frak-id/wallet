import Foundation

/// The identity route this app uses to reach `GET /user/merchant/resolve`: either an
/// explicit merchant id, or resolution by bundle id. Exactly one is sent per request.
enum MerchantQuery: Sendable {
    /// Wire value of `?platform=`. `android` is the Kotlin twin's constant.
    static let iosPlatform = "ios"

    case id(merchantId: String, lang: String?)
    case bundleId(bundleId: String, lang: String?)

    var parameters: [String: String?] {
        switch self {
        case .id(let merchantId, let lang):
            return ["merchantId": merchantId, "lang": lang]
        case .bundleId(let bundleId, let lang):
            // The backend's query parameter is `packageId` on both platforms; only the
            // Swift-facing name is `bundleId`.
            return ["packageId": bundleId, "platform": Self.iosPlatform, "lang": lang]
        }
    }

    /// A stable cache key, mirroring the backend's own key shape so two routes that
    /// resolve to the same merchant don't silently share an entry.
    var cacheKey: String {
        switch self {
        case .id(let merchantId, let lang):
            return "id:\(merchantId):\(lang ?? "")"
        case .bundleId(let bundleId, let lang):
            return "pkg:\(Self.iosPlatform):\(bundleId.lowercased()):\(lang ?? "")"
        }
    }

    /// Picks the route for `config`: `merchantId` first, matching the backend's own precedence.
    static func from(_ config: FrakConfig) throws -> MerchantQuery {
        let lang = config.metadata.lang?.rawValue
        if let merchantId = config.merchantId?.trimmed, !merchantId.isEmpty {
            return .id(merchantId: merchantId, lang: lang)
        }
        if let bundleId = config.bundleId?.trimmed, !bundleId.isEmpty {
            return .bundleId(bundleId: bundleId, lang: lang)
        }
        throw FrakError.merchantResolutionFailed(
            reason: "FrakConfig carries neither a merchantId nor a bundleId. "
                + "Set FrakConfig.merchantId, or leave bundleId nil so it is read from Bundle.main."
        )
    }
}

extension String {
    fileprivate var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
