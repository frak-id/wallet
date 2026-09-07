enum InstallLinks {
    // Storefront-less on purpose: the App Store app resolves it against the user's own storefront,
    // while the same form 404s in a browser outside the territories the app is sold in.
    private static let appStoreURL = "https://apps.apple.com/app/id6759159306"

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

    /// The same payload as `deepLink`, addressed to the wallet's own universal-link domain
    /// instead of its custom scheme. Tried first: `open(_:options:[.universalLinksOnly: true])`
    /// opens silently on an installed app and answers false rather than falling through to a
    /// Safari tab on one that is not, so failing this rung costs nothing `deepLink` would not
    /// also have to recover from.
    static func universalLink(
        walletOrigin: String,
        merchantId: String,
        anonymousId: String,
        installProof: String? = nil
    ) -> String {
        let url =
            "\(walletOrigin)/install?m=\(PercentEncoding.encode(merchantId))"
            + "&a=\(PercentEncoding.encode(anonymousId))"
        guard let installProof else { return url }
        return url + "#p=" + PercentEncoding.encode(installProof)
    }

    /// The wallet's hosted install page (install code plus store link) — what the sharing sheet
    /// navigates to, as opposed to the store listing `appStore()` returns. The proof rides in the
    /// fragment; `returnScheme`/`sessionId` let the page hand the code back. `clip=host` stops the
    /// page writing the code too: both writes land, and a plain one arriving after this SDK's
    /// `localOnly` and expiring write replaces it.
    static func installPage(
        walletOrigin: String,
        merchantId: String,
        anonymousId: String,
        returnScheme: String,
        sessionId: String,
        proof: String?
    ) -> String {
        let url =
            "\(walletOrigin)/install?embed=native&clip=host"
            + "&m=\(PercentEncoding.encode(merchantId))"
            + "&a=\(PercentEncoding.encode(anonymousId))"
            + "&returnScheme=\(PercentEncoding.encode(returnScheme))"
            + "&sid=\(PercentEncoding.encode(sessionId))"
        guard let proof else { return url }
        return url + "#p=" + PercentEncoding.encode(proof)
    }
}
