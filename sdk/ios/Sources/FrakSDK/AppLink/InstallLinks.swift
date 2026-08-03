enum InstallLinks {
    // Single App Store listing for all stages; dev build installs out of band.
    private static let appStoreURL = "https://apps.apple.com/app/id6740261164"

    /// Links this installation's anonymous id to the user's wallet.
    static func deepLink(scheme: String, merchantId: String, anonymousId: String) -> String {
        "\(scheme)://install?m=\(PercentEncoding.encode(merchantId))&a=\(PercentEncoding.encode(anonymousId))"
    }

    // No identity carried: iOS has no Play-style install referrer.
    static func appStore() -> String {
        appStoreURL
    }

    /// The wallet's hosted install page, which shows the install code and the store link.
    ///
    /// Distinct from `appStore()`, which is the store listing itself. This is the page the
    /// sharing sheet navigates to, so the user never leaves the merchant app to reach it.
    ///
    /// The proof rides in the fragment, matching the wallet's own `buildInstallUrl`: a
    /// fragment is never sent to a server, never logged and never in a `Referer`, and it
    /// survives here because the sheet loads this URL directly rather than routing it
    /// through an in-app navigation that would drop it.
    /// `returnScheme`/`sessionId` are what let the page hand the install code back, which the
    /// SDK needs in order to put it on the pasteboard with an expiry and `localOnly`. Both are
    /// query params and the proof stays in the fragment, so the fragment remains last.
    static func installPage(
        walletOrigin: String,
        merchantId: String,
        anonymousId: String,
        returnScheme: String,
        sessionId: String,
        proof: String?
    ) -> String {
        let url =
            "\(walletOrigin)/install?m=\(PercentEncoding.encode(merchantId))"
            + "&a=\(PercentEncoding.encode(anonymousId))"
            + "&returnScheme=\(PercentEncoding.encode(returnScheme))"
            + "&sid=\(PercentEncoding.encode(sessionId))"
        guard let proof else { return url }
        return url + "#p=" + PercentEncoding.encode(proof)
    }
}
