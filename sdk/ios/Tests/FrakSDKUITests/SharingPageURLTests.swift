import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("SharingPageURL")
struct SharingPageURLTests {
    /// The wallet's own `sanitizeReturnScheme`. A scheme that fails it makes the page drop
    /// every callback silently, so this is asserted here rather than trusted.
    private func matchesWalletPattern(_ scheme: String) -> Bool {
        guard scheme.hasPrefix("frak-") else { return false }
        let suffix = scheme.dropFirst("frak-".count)
        guard (1...60).contains(suffix.count) else { return false }
        return suffix.allSatisfy { $0.isASCII && ($0.isNumber || ("a"..."z").contains($0) || ".-_".contains($0)) }
    }

    @Test("derives the return scheme from the bundle id")
    func derivesTheReturnScheme() {
        let scheme = SharingPageURL.returnScheme(bundleId: "com.groupeseb.moulinex.food")
        #expect(scheme == "frak-com.groupeseb.moulinex.food")
        #expect(matchesWalletPattern(scheme))
    }

    @Test("lowercases and strips whatever the wallet's pattern rejects")
    func sanitisesTheBundleId() {
        #expect(SharingPageURL.returnScheme(bundleId: "com.Acme.App") == "frak-com.acme.app")
        #expect(matchesWalletPattern(SharingPageURL.returnScheme(bundleId: "com.acme:remote")))
    }

    @Test("bounds the suffix and never emits a bare prefix")
    func boundsAndBackfillsTheSuffix() {
        let long = SharingPageURL.returnScheme(bundleId: String(repeating: "a", count: 200))
        #expect(long.count == "frak-".count + 60)
        #expect(matchesWalletPattern(long))

        #expect(SharingPageURL.returnScheme(bundleId: "///") == "frak-app")
        #expect(matchesWalletPattern(SharingPageURL.returnScheme(bundleId: "///")))
    }

    @Test("carries everything the hosted page needs, and nothing it was not given")
    func buildsTheMinimalPageURL() {
        let url = SharingPageURL.build(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "550e8400-e29b-41d4-a716-446655440000",
            clientId: "550e8400-e29b-41d4-a716-446655440001",
            bundleId: "com.acme.app",
            sessionId: "session-1"
        )

        #expect(
            url == "https://wallet.frak.id/sharing?native=1"
                + "&merchantId=550e8400-e29b-41d4-a716-446655440000"
                + "&clientId=550e8400-e29b-41d4-a716-446655440001"
                + "&returnScheme=frak-com.acme.app"
                + "&sid=session-1"
                + "&\(FrakSDKVersion.queryParameterName)=\(FrakSDKVersion.current)"
        )
    }

    @Test("percent-encodes the optional parameters")
    func buildsTheFullPageURL() {
        let url = SharingPageURL.build(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "550e8400-e29b-41d4-a716-446655440000",
            clientId: "550e8400-e29b-41d4-a716-446655440001",
            bundleId: "com.acme.app",
            sessionId: "session-1",
            appName: "Acme Shop",
            logoURL: "https://acme.example/logo.png",
            link: "https://acme.example/p?a=1",
            products: #"[{"title":"Kettle"}]"#,
            seededReward: "10 €"
        )

        #expect(url.contains("&appName=Acme%20Shop"))
        #expect(url.contains("&logoUrl=https%3A%2F%2Facme.example%2Flogo.png"))
        #expect(url.contains("&link=https%3A%2F%2Facme.example%2Fp%3Fa%3D1"))
        #expect(url.contains("&products=%5B%7B%22title%22%3A%22Kettle%22%7D%5D"))
        #expect(url.hasSuffix("&r=10%20%E2%82%AC"))
    }

    @Test("the warm url is the real merchant page, flagged as a preload")
    func buildsTheWarmURL() {
        let url = SharingPageURL.warm(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "550e8400-e29b-41d4-a716-446655440000",
            clientId: "550e8400-e29b-41d4-a716-446655440001",
            bundleId: "com.acme.app",
            appName: "Acme Shop",
            logoURL: "https://acme.example/logo.png"
        )

        #expect(
            url == "https://wallet.frak.id/sharing?native=1&preload=1"
                + "&merchantId=550e8400-e29b-41d4-a716-446655440000"
                + "&clientId=550e8400-e29b-41d4-a716-446655440001"
                + "&returnScheme=frak-com.acme.app"
                + "&sid=warm"
                + "&\(FrakSDKVersion.queryParameterName)=\(FrakSDKVersion.current)"
                + "&appName=Acme%20Shop"
                + "&logoUrl=https%3A%2F%2Facme.example%2Flogo.png"
        )
    }

    /// `preload=1` is what keeps a warmed page reporting `sharing_page_preloaded` rather than
    /// `sharing_page_viewed`, which is the sharing funnel's denominator. Warming every merchant
    /// surface into that event would silently deflate every downstream rate.
    @Test("the warm url carries no per-tap parameter")
    func warmURLCarriesNothingPerTap() {
        let url = SharingPageURL.warm(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "m1",
            clientId: "c1",
            bundleId: "com.acme.app"
        )

        #expect(url.contains("&preload=1"))
        #expect(url.contains("&sid=\(SharingPageURL.warmSessionId)"))
        // No link, no products, no seeded headline, no confirmation — none of them is knowable
        // before the tap, and the warm session id can never satisfy a real sheet's `sid` guard.
        #expect(!url.contains("&link="))
        #expect(!url.contains("&products="))
        #expect(!url.contains("&r="))
        #expect(!url.contains("&confirmed="))
    }

    @Test("the activation fragment carries the per-tap half, and clears the preload flag")
    func buildsTheActivationFragment() {
        let fragment = SharingPageURL.activationFragment(
            sessionId: "session-1",
            link: "https://acme.example/p?a=1",
            products: #"[{"title":"Kettle"}]"#,
            logoURL: "https://acme.example/override.png",
            seededReward: "10 \u{20AC}",
            confirmed: true
        )

        #expect(
            fragment == "#sid=session-1"
                + "&preload=0"
                + "&link=https%3A%2F%2Facme.example%2Fp%3Fa%3D1"
                + "&products=%5B%7B%22title%22%3A%22Kettle%22%7D%5D"
                + "&logoUrl=https%3A%2F%2Facme.example%2Foverride.png"
                + "&r=10%20%E2%82%AC"
                + "&confirmed=1"
        )
    }

    /// Load-bearing, not tidiness. The page spreads the fragment over the warm URL's own query
    /// params, so a key written with an empty value would erase the merchant config value under
    /// it — `logoUrl` comes from the config on the warm URL, and most activations have nothing
    /// to say about it.
    @Test("the activation fragment omits every key it was not given")
    func activationFragmentOmitsAbsentKeys() {
        let fragment = SharingPageURL.activationFragment(sessionId: "session-1")

        #expect(fragment == "#sid=session-1&preload=0")
        #expect(!fragment.contains("logoUrl"))
        #expect(!fragment.contains("link"))
        #expect(!fragment.contains("products"))
        #expect(!fragment.contains("&r="))
        // Absent, not `confirmed=0`: the page reads presence, and this is the pre-share step.
        #expect(!fragment.contains("confirmed"))
    }

    /// The fragment is hung off the *committed* URL, never off the warm URL string, so this is
    /// about the page's own parsing rather than about concatenation. Two identical fragments in
    /// a row fire no `hashchange`, which a fresh `sid` per session is what prevents.
    @Test("every activation fragment starts a new session")
    func activationFragmentIsSessionScoped() {
        let first = SharingPageURL.activationFragment(sessionId: "session-1")
        let second = SharingPageURL.activationFragment(sessionId: "session-2")
        #expect(first != second)
    }
}

@Suite("SharingResult")
struct SharingResultTests {
    /// A session can produce several outcomes; the caller is told the most significant.
    @Test("ranks install above a share, and a share above a dismissal")
    func ranksOutcomes() {
        #expect(SharingResult.installStarted.significance > SharingResult.shared(link: "l").significance)
        #expect(SharingResult.shared(link: "l").significance > SharingResult.dismissed.significance)
        #expect(SharingResult.copied(link: "l").significance == SharingResult.shared(link: "l").significance)
        #expect(SharingResult.dismissed.significance > SharingResult.failed(.notInitialized).significance)
    }
}
