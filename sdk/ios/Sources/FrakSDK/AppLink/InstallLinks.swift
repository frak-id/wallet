enum InstallLinks {
    // Single App Store listing for all stages; dev build installs out of band.
    private static let appStoreURL = "https://apps.apple.com/app/id6740261164"

    /// Links this installation's anonymous id to the user's wallet.
    ///
    /// `installProof` rides as a search param, not a fragment: the wallet's deep-link router
    /// calls `navigate`, so the hash is already gone by the time `/install` renders.
    static func deepLink(
        scheme: String,
        merchantId: String,
        anonymousId: String,
        installProof: String? = nil
    ) -> String {
        let url =
            "\(scheme)://install?m=\(PercentEncoding.encode(merchantId))"
            + "&a=\(PercentEncoding.encode(anonymousId))"
        guard let installProof else { return url }
        return url + "&p=" + PercentEncoding.encode(installProof)
    }

    // No identity carried: iOS has no Play-style install referrer.
    static func appStore() -> String {
        appStoreURL
    }

    /// The wallet's hosted install page (install code plus store link) — what the sharing sheet
    /// navigates to, as opposed to the store listing `appStore()` returns.
    ///
    /// The proof rides in the fragment, matching the wallet's own `buildInstallUrl`;
    /// `returnScheme`/`sessionId` let the page hand the install code back.
    static func installPage(
        walletOrigin: String,
        merchantId: String,
        anonymousId: String,
        returnScheme: String,
        sessionId: String,
        proof: String?
    ) -> String {
        let url =
            "\(walletOrigin)/install?embed=native"
            + "&m=\(PercentEncoding.encode(merchantId))"
            + "&a=\(PercentEncoding.encode(anonymousId))"
            + "&returnScheme=\(PercentEncoding.encode(returnScheme))"
            + "&sid=\(PercentEncoding.encode(sessionId))"
        guard let proof else { return url }
        return url + "#p=" + PercentEncoding.encode(proof)
    }
}
