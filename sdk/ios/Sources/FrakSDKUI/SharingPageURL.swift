import FrakSDK

// Hosted /sharing URL the sheet's web view loads. No bridge back to native: state
// goes in as query params, comes out as an intercepted navigation to returnScheme://result.
enum SharingPageURL {
    static let resultHost = "result"

    /// The `sid` a warmed, unpresented page carries.
    ///
    /// Never a real sheet's id, so a result navigation from the warm page can never be
    /// attributed to whichever session binds next. Lives here rather than on
    /// `SharingWebViewBinding` because that type is behind `#if canImport(UIKit)` and this
    /// file is not.
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

    /// The URL a pooled view is warmed on: everything knowable before the user taps.
    ///
    /// Unlike a neutral warm-up this carries the real `merchantId` and `clientId`, so the page
    /// boots its bundle, i18n and both merchant-keyed queries while the user is still looking
    /// at the merchant's own screen. `preload=1` is what makes that safe — the page reports
    /// itself as `sharing_page_preloaded` instead of `sharing_page_viewed`, so warming surfaces
    /// nobody opens cannot inflate the sharing funnel's denominator.
    ///
    /// What is missing is exactly `activationFragment(sessionId:...)`'s job.
    static func warm(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        bundleId: String,
        appName: String? = nil,
        logoURL: String? = nil
    ) -> String {
        var url = "\(walletOrigin)/sharing?native=1&preload=1"
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

    /// The per-tap params, as a fragment to hang off a `warm(...)` URL.
    ///
    /// A fragment change is a same-document navigation: no request, no remount, no React boot —
    /// which is the whole point, since that boot is the last large block of tap-to-paint the
    /// native side could not otherwise reach.
    ///
    /// Only keys with something to say are written. The page spreads this over the warm URL's
    /// own params, so writing a key with an empty value would erase the merchant config value
    /// under it rather than leave it alone.
    static func activationFragment(
        sessionId: String,
        link: String? = nil,
        products: String? = nil,
        logoURL: String? = nil,
        seededReward: String? = nil,
        confirmed: Bool = false
    ) -> String {
        var fragment = "#sid=" + PercentEncoding.encode(sessionId)
        // Explicit, not implied: this is what turns the page from a warm-up into a view, and
        // the event it reports depends on it.
        fragment += "&preload=0"
        for (key, value) in [
            // `logoUrl` only when the request overrode it; otherwise the warm URL's config
            // value stands.
            ("link", link), ("products", products), ("logoUrl", logoURL), ("r", seededReward),
        ] {
            if let value {
                fragment += "&\(key)=" + PercentEncoding.encode(value)
            }
        }
        if confirmed { fragment += "&confirmed=1" }
        return fragment
    }
}
