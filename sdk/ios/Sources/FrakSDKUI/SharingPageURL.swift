import FrakSDK

// Hosted /sharing URL the sheet's web view loads. No bridge back to native: state
// goes in as query params, comes out as an intercepted navigation to returnScheme://result.
enum SharingPageURL {
    static let resultHost = "result"

    /// The `sid` a warmed, unpresented page carries. Never a real sheet's id, so a result
    /// navigation from the warm page cannot be attributed to whichever session binds next.
    static let warmSessionId = "warm"

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

    // `&view=confirmation` is appended separately by SharingSession.url(confirmed:).
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
        var url = "\(walletOrigin)/sharing?embed=native"
        url += "&merchantId=" + PercentEncoding.encode(merchantId)
        url += "&clientId=" + PercentEncoding.encode(clientId)
        url += "&returnScheme=" + PercentEncoding.encode(returnScheme(bundleId: bundleId))
        url += "&sid=" + PercentEncoding.encode(sessionId)
        url += "&\(FrakSDKVersion.queryParameterName)=" + PercentEncoding.encode(FrakSDKVersion.current)
        for (key, value) in [
            ("appName", appName), ("logoUrl", logoURL), ("link", link),
            ("products", products), ("seedReward", seededReward),
        ] {
            if let value {
                url += "&\(key)=" + PercentEncoding.encode(value)
            }
        }
        return url
    }

    /// The URL a pooled view is warmed on: everything knowable before the user taps.
    ///
    /// `state=warm` makes the page report itself as `sharing_page_preloaded` rather than
    /// `sharing_page_viewed`, so warm-ups nobody opens stay out of the sharing funnel.
    static func warm(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        bundleId: String,
        appName: String? = nil,
        logoURL: String? = nil
    ) -> String {
        var url = "\(walletOrigin)/sharing?embed=native&state=warm"
        url += "&merchantId=" + PercentEncoding.encode(merchantId)
        url += "&clientId=" + PercentEncoding.encode(clientId)
        url += "&returnScheme=" + PercentEncoding.encode(returnScheme(bundleId: bundleId))
        url += "&sid=" + warmSessionId
        url += "&\(FrakSDKVersion.queryParameterName)=" + PercentEncoding.encode(FrakSDKVersion.current)
        for (key, value) in [("appName", appName), ("logoUrl", logoURL)] {
            if let value {
                url += "&\(key)=" + PercentEncoding.encode(value)
            }
        }
        return url
    }

    /// The per-tap params, as a fragment to hang off a `warm(...)` URL — a same-document
    /// navigation, so no request and no React boot.
    ///
    /// Only keys with something to say are written: the page spreads this over the warm URL's
    /// own params, so an empty value would erase the merchant config value under it.
    static func activationFragment(
        sessionId: String,
        link: String? = nil,
        products: String? = nil,
        logoURL: String? = nil,
        seededReward: String? = nil,
        confirmed: Bool = false
    ) -> String {
        var fragment = "#sid=" + PercentEncoding.encode(sessionId)
        // Turns the page from a warm-up into a view; the event it reports depends on it.
        fragment += "&state=live"
        for (key, value) in [
            // `logoUrl` only when the request overrode it; otherwise the warm URL's config
            // value stands.
            ("link", link), ("products", products), ("logoUrl", logoURL), ("seedReward", seededReward),
        ] {
            if let value {
                fragment += "&\(key)=" + PercentEncoding.encode(value)
            }
        }
        if confirmed { fragment += "&view=confirmation" }
        return fragment
    }
}
