import FrakSDK

// Hosted /sharing URL the sheet's web view loads. No bridge back to native: state
// goes in as query params, comes out as an intercepted navigation to returnScheme://result.
enum SharingPageURL {
    static let resultHost = "result"

    private static let maxSchemeSuffix = 60

    // Must match wallet's ^frak-[a-z0-9._-]{1,60}$ or callbacks silently drop.
    static func returnScheme(bundleId: String) -> String {
        let sanitised = String(
            bundleId
                .lowercased()
                .filter { $0.isASCII && ($0.isNumber || ("a"..."z").contains($0) || ".-_".contains($0)) }
                .prefix(maxSchemeSuffix)
        )
        // Fall back to "app" if sanitising strips every character (bare "frak-" wouldn't match).
        return "frak-" + (sanitised.isEmpty ? "app" : sanitised)
    }

    // `&confirmed=1` is appended separately by SharingSession.url(confirmed:).
    static func build(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        bundleId: String,
        sessionId: String,
        appName: String? = nil,
        logoURL: String? = nil,
        link: String? = nil,
        products: String? = nil,
        seededReward: String? = nil
    ) -> String {
        var url = "\(walletOrigin)/sharing?native=1"
        url += "&merchantId=" + PercentEncoding.encode(merchantId)
        url += "&clientId=" + PercentEncoding.encode(clientId)
        url += "&returnScheme=" + PercentEncoding.encode(returnScheme(bundleId: bundleId))
        url += "&sid=" + PercentEncoding.encode(sessionId)
        url += "&\(FrakSDKVersion.queryParameterName)=" + PercentEncoding.encode(FrakSDKVersion.current)
        for (key, value) in [
            ("appName", appName), ("logoUrl", logoURL), ("link", link), ("products", products), ("r", seededReward),
        ] {
            if let value {
                url += "&\(key)=" + PercentEncoding.encode(value)
            }
        }
        return url
    }
}
