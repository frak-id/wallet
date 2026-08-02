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
