@_spi(FrakInternal) import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("SharingPageURL")
struct SharingPageURLTests {
    /// Mirror of the wallet's own `sanitizeReturnScheme`; a scheme that fails it makes the page
    /// drop every callback silently.
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
            url == "https://wallet.frak.id/sharing?embed=native"
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
        #expect(url.hasSuffix("&seedReward=10%20%E2%82%AC"))
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
            url == "https://wallet.frak.id/sharing?embed=native&state=warm"
                + "&merchantId=550e8400-e29b-41d4-a716-446655440000"
                + "&clientId=550e8400-e29b-41d4-a716-446655440001"
                + "&returnScheme=frak-com.acme.app"
                + "&sid=warm"
                + "&\(FrakSDKVersion.queryParameterName)=\(FrakSDKVersion.current)"
                + "&appName=Acme%20Shop"
                + "&logoUrl=https%3A%2F%2Facme.example%2Flogo.png"
        )
    }

    @Test("the warm url carries no per-tap parameter")
    func warmURLCarriesNothingPerTap() {
        let url = SharingPageURL.warm(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "m1",
            clientId: "c1",
            bundleId: "com.acme.app"
        )

        #expect(url.contains("&state=warm"))
        #expect(url.contains("&sid=\(SharingPageURL.warmSessionId)"))
        // None of these is knowable before the tap.
        #expect(!url.contains("&link="))
        #expect(!url.contains("&products="))
        #expect(!url.contains("&seedReward="))
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
                + "&state=live"
                + "&link=https%3A%2F%2Facme.example%2Fp%3Fa%3D1"
                + "&products=%5B%7B%22title%22%3A%22Kettle%22%7D%5D"
                + "&logoUrl=https%3A%2F%2Facme.example%2Foverride.png"
                + "&seedReward=10%20%E2%82%AC"
                + "&view=confirmation"
        )
    }

    /// The page spreads the fragment over the warm URL's own query params, so a key written with
    /// an empty value would erase the merchant-config value under it.
    @Test("the activation fragment omits every key it was not given")
    func activationFragmentOmitsAbsentKeys() {
        let fragment = SharingPageURL.activationFragment(sessionId: "session-1")

        #expect(fragment == "#sid=session-1&state=live")
        #expect(!fragment.contains("logoUrl"))
        #expect(!fragment.contains("link"))
        #expect(!fragment.contains("products"))
        #expect(!fragment.contains("&seedReward="))
        // Absent, not `confirmed=0`: the page reads presence, and this is the pre-share step.
        #expect(!fragment.contains("confirmed"))
    }

    @Test("every activation fragment starts a new session")
    func activationFragmentIsSessionScoped() {
        let first = SharingPageURL.activationFragment(sessionId: "session-1")
        let second = SharingPageURL.activationFragment(sessionId: "session-2")
        #expect(first != second)
    }

    @Test("the probe keys append to a proof fragment installPageURL already returned")
    func installPageProbedAppendsToAnExistingProof() {
        let page = "https://wallet.frak.id/install?m=m1&a=a1#p=AQR-_x"
        let probed = SharingPageURL.installPageProbed(page, sid: "session-1", probe: .ok)
        #expect(probed == "https://wallet.frak.id/install?m=m1&a=a1#p=AQR-_x&sid=session-1&probe=ok")
    }

    @Test("the probe keys open a fragment when installPageURL carried no proof")
    func installPageProbedWithNoProof() {
        let page = "https://wallet.frak.id/install?m=m1&a=a1"
        let probed = SharingPageURL.installPageProbed(page, sid: "session-1", probe: .undeclared)
        #expect(probed == "https://wallet.frak.id/install?m=m1&a=a1#sid=session-1&probe=undeclared")
    }

    @Test("a merchant opt-out is spelled disabled, not undeclared")
    func installPageProbedCarriesDisabled() {
        let probed = SharingPageURL.installPageProbed(
            "https://wallet.frak.id/install?m=m1",
            sid: "s1",
            probe: .disabled
        )
        #expect(probed.hasSuffix("#sid=s1&probe=disabled"))
    }

    @Test("the detection fragment carries every contract key")
    func installDetectedFragmentCarriesEveryKey() {
        let fragment = SharingPageURL.installDetectedFragment(
            proof: "AQR-_x",
            sid: "session-1",
            probe: .ok,
            elapsedMillis: 4200,
            surface: .overlay
        )
        #expect(fragment == "#p=AQR-_x&sid=session-1&probe=ok&installed=1&dt=4200&via=overlay")
    }

    @Test("the detection fragment omits p entirely when there is no proof, never a bare p=")
    func installDetectedFragmentOmitsAbsentProof() {
        let fragment = SharingPageURL.installDetectedFragment(
            proof: nil,
            sid: "session-1",
            probe: .undeclared,
            elapsedMillis: 0,
            surface: .product
        )
        #expect(fragment == "#sid=session-1&probe=undeclared&installed=1&dt=0&via=product")
        #expect(!fragment.contains("p="))
    }

    @Test("the language tag reaches the page as lng, on both the tap URL and the warm URL")
    func languageReachesBothURLs() {
        let built = SharingPageURL.build(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "merchant",
            clientId: "client",
            bundleId: "com.acme.app",
            sessionId: "1",
            language: "fr-CA"
        )
        let warmed = SharingPageURL.warm(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "merchant",
            clientId: "client",
            bundleId: "com.acme.app",
            language: "fr-CA"
        )
        #expect(built.contains("&lng=fr-CA"))
        #expect(warmed.contains("&lng=fr-CA"))
    }

    @Test("no language writes no lng, so the page falls back to its own detection")
    func absentLanguageWritesNothing() {
        let url = SharingPageURL.build(
            walletOrigin: "https://wallet.frak.id",
            merchantId: "merchant",
            clientId: "client",
            bundleId: "com.acme.app",
            sessionId: "1"
        )
        #expect(!url.contains("lng="))
    }

    @Test("a warm URL built with one language does not match one built with another")
    func warmURLsDifferByLanguage() {
        func warm(_ language: String?) -> String {
            SharingPageURL.warm(
                walletOrigin: "https://wallet.frak.id",
                merchantId: "merchant",
                clientId: "client",
                bundleId: "com.acme.app",
                language: language
            )
        }
        // The session compares these strings to decide whether it can activate a warm view, so a
        // language that changes between warm and tap must cost the warm view, never the language.
        #expect(warm("en") != warm("fr"))
        #expect(warm("en") == warm("en"))
    }

    @Test("configuration falls back to the device locale, never to nothing")
    func configurationResolvesALanguage() {
        #expect(FrakSharingConfiguration(language: "de").resolvedLanguage == "de")
        #expect(!FrakSharingConfiguration().resolvedLanguage.isEmpty)
    }

    @Test("the detection fragment percent-encodes the proof")
    func installDetectedFragmentEncodesTheProof() {
        let fragment = SharingPageURL.installDetectedFragment(
            proof: "a b",
            sid: "session-1",
            probe: .ok,
            elapsedMillis: 1,
            surface: .product
        )
        #expect(fragment.contains("p=a%20b"))
    }
}
