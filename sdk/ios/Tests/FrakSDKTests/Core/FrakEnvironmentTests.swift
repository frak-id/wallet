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

    @Test("lets a merchant override the wallet scheme it probes for")
    func customOverridesWalletScheme() {
        let custom = FrakEnvironment.custom(wallet: "https://a", backend: "https://b", walletScheme: "acmewallet-stub")
        #expect(custom.walletScheme == "acmewallet-stub")
    }

    @Test("accepts https unconditionally")
    func customAcceptsHttps() {
        let custom = FrakEnvironment.custom(wallet: "https://a", backend: "https://b")

        #expect(custom.wallet == "https://a")
        #expect(custom.backend == "https://b")
        #expect(custom.customOriginRejectionReason == nil)
    }

    @Test("accepts http to documented loopback and private hosts")
    func customAcceptsLoopbackAndPrivateHttp() {
        let loopbackHosts = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://10.0.2.2:3000",  // Android emulator host alias; iOS shares the allowlist
            "http://10.0.3.2:3000",  // Genymotion host alias
            "http://my-machine.local:3000",
            // Underscore host: Android reaches this only via its authority fallback, since
            // `java.net.URI.getHost()` is null for a registry-based authority. Pinned on both
            // sides so the platforms cannot drift apart again.
            "http://my_host.local:3000",
            "http://10.1.2.3:3000",  // 10.0.0.0/8
            "http://172.16.0.5:3000",  // 172.16.0.0/12
            "http://172.31.255.255:3000",  // 172.16.0.0/12 upper bound
            "http://192.168.1.5:3000",  // 192.168.0.0/16
        ]

        for origin in loopbackHosts {
            let custom = FrakEnvironment.custom(wallet: origin, backend: "https://b")
            #expect(custom.wallet == origin, "expected \(origin) to be accepted as-is")
            #expect(custom.customOriginRejectionReason == nil, "expected \(origin) to have no rejection reason")
        }
    }

    @Test("rejects http to a public host")
    func customRejectsPublicHttp() {
        let custom = FrakEnvironment.custom(wallet: "http://example.com", backend: "https://b")

        #expect(custom.wallet != "http://example.com")
        #expect(custom.wallet.hasPrefix("https://"))
        #expect(custom.customOriginRejectionReason?.contains("example.com") == true)
    }

    @Test("rejects a file scheme, even for a documented loopback host")
    func customRejectsFileScheme() {
        let custom = FrakEnvironment.custom(wallet: "file:///etc/passwd", backend: "https://b")

        #expect(custom.wallet != "file:///etc/passwd")
        #expect(custom.wallet.hasPrefix("https://"))
        #expect(custom.customOriginRejectionReason?.contains("file:///etc/passwd") == true)
    }

    @Test("rejects data and javascript schemes")
    func customRejectsDataAndJavascriptSchemes() {
        let data = FrakEnvironment.custom(wallet: "data:text/plain;base64,Zm9v", backend: "https://b")
        let js = FrakEnvironment.custom(wallet: "javascript:alert(1)", backend: "https://b")

        #expect(data.wallet.hasPrefix("https://"))
        #expect(js.wallet.hasPrefix("https://"))
        #expect(data.customOriginRejectionReason != nil)
        #expect(js.customOriginRejectionReason != nil)
    }

    @Test("rejects a non-https wallet or backend origin rather than reach it")
    func customRejectsNonHttps() {
        let cleartext = FrakEnvironment.custom(wallet: "http://a", backend: "https://b")
        let file = FrakEnvironment.custom(wallet: "https://a", backend: "file:///etc/passwd")

        // Not thrown, matching FrakConfig's "never validated at construction": swapped for an
        // unreachable placeholder. Unlike a malformed URL, this placeholder is well-formed —
        // failure surfaces at request time as a DNS failure inside FrakError.network, and
        // Frak.initialize separately logs the rejection (with the offending origin and rule) at
        // .error, since FrakEnvironment itself has no logger in scope to do so.
        #expect(cleartext.wallet != "http://a")
        #expect(cleartext.wallet.hasPrefix("https://"))
        #expect(file.backend != "file:///etc/passwd")
        #expect(file.backend.hasPrefix("https://"))
    }

    @Test("names the offending origin and combines both when both are rejected")
    func rejectionReasonNamesBothOffendingOrigins() {
        let bothRejected = FrakEnvironment.custom(wallet: "file:///etc/passwd", backend: "http://example.com")

        let reason = bothRejected.customOriginRejectionReason
        #expect(reason != nil)
        #expect(reason?.contains("file:///etc/passwd") == true)
        #expect(reason?.contains("example.com") == true)
    }
}
