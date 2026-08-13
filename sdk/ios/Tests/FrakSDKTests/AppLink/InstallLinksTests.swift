import Testing

@testable import FrakSDK

@Suite("InstallLinks")
struct InstallLinksTests {
    private static let merchantId = "550e8400-e29b-41d4-a716-446655440000"
    private static let clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45"

    @Test("builds the wallet deep link the install route expects")
    func buildsTheWalletDeepLink() {
        #expect(
            InstallLinks.deepLink(scheme: "frakwallet", merchantId: Self.merchantId, anonymousId: Self.clientId)
                == "frakwallet://install?m=\(Self.merchantId)&a=\(Self.clientId)"
        )
    }

    @Test("percent-encodes identifiers that are not already url-safe")
    func percentEncodesIdentifiers() {
        #expect(
            InstallLinks.deepLink(scheme: "frakwallet", merchantId: "a&b", anonymousId: "c d")
                == "frakwallet://install?m=a%26b&a=c%20d"
        )
    }

    /// `?p=`, not `#p=`: the router navigates in-app, so a fragment is gone before `/install`.
    @Test("carries the install proof as a search param the deep-link router forwards")
    func carriesTheInstallProof() {
        #expect(
            InstallLinks.deepLink(
                scheme: "frakwallet",
                merchantId: Self.merchantId,
                anonymousId: Self.clientId,
                installProof: "AQR-_x"
            )
                == "frakwallet://install?m=\(Self.merchantId)&a=\(Self.clientId)&p=AQR-_x"
        )
    }

    @Test("marks the hosted install page as host-embedded, the same way the sharing url does")
    func marksTheInstallPageAsHostEmbedded() {
        let url = InstallLinks.installPage(
            walletOrigin: "https://wallet.frak.id",
            merchantId: Self.merchantId,
            anonymousId: Self.clientId,
            returnScheme: "frak-com.acme.app",
            sessionId: "session-1",
            proof: nil
        )

        #expect(
            url == "https://wallet.frak.id/install?embed=native&m=\(Self.merchantId)"
                + "&a=\(Self.clientId)&returnScheme=frak-com.acme.app&sid=session-1"
        )
        // iOS injects no chrome: a SwiftUI `.sheet` already clips to the system radius.
        #expect(!url.contains("cornerRadius"))
    }

    @Test("points at the wallet's App Store listing")
    func pointsAtTheAppStoreListing() {
        #expect(InstallLinks.appStore() == "https://apps.apple.com/app/id6759159306")
    }

    @Test("builds the universal-link form of the deep link, over the wallet's own origin")
    func buildsTheUniversalLink() {
        #expect(
            InstallLinks.universalLink(
                walletOrigin: "https://wallet.frak.id",
                merchantId: Self.merchantId,
                anonymousId: Self.clientId
            )
                == "https://wallet.frak.id/install?m=\(Self.merchantId)&a=\(Self.clientId)"
        )
    }

    @Test("carries the proof as a fragment, matching the deep link's own field name")
    func universalLinkCarriesTheProofAsAFragment() {
        #expect(
            InstallLinks.universalLink(
                walletOrigin: "https://wallet.frak.id",
                merchantId: Self.merchantId,
                anonymousId: Self.clientId,
                installProof: "AQR-_x"
            )
                == "https://wallet.frak.id/install?m=\(Self.merchantId)&a=\(Self.clientId)#p=AQR-_x"
        )
    }
}
