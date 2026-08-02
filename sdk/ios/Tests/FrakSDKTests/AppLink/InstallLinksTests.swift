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

    @Test("points at the wallet's App Store listing")
    func pointsAtTheAppStoreListing() {
        #expect(InstallLinks.appStore() == "https://apps.apple.com/app/id6740261164")
    }
}
