import Testing

@testable import FrakSDK

@Suite("FrakEnvironment")
struct FrakEnvironmentTests {
    @Test("states both origins per stage, with no trailing slash")
    func statesBothOrigins() {
        #expect(FrakEnvironment.production.wallet == "https://wallet.frak.id")
        #expect(FrakEnvironment.production.backend == "https://backend.frak.id")
        #expect(FrakEnvironment.development.backend == "https://backend.gcp-dev.frak.id")

        let local = FrakEnvironment.custom(wallet: "https://localhost:3000/", backend: "https://localhost:3030/")
        #expect(local.wallet == "https://localhost:3000")
        #expect(local.backend == "https://localhost:3030")
    }

    /// A locally-built dev wallet registers its own scheme, so a POC running against the dev
    /// stage is invisible to a probe that only knows the production one.
    @Test("names the wallet scheme per stage")
    func namesTheWalletScheme() {
        #expect(FrakEnvironment.production.walletScheme == "frakwallet")
        #expect(FrakEnvironment.development.walletScheme == "frakwallet-dev")
        #expect(FrakEnvironment.custom(wallet: "https://a", backend: "https://b").walletScheme == "frakwallet-dev")
    }
}
