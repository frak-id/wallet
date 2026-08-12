import Foundation
import Testing

@testable import FrakSDK

@Suite("IdentityMerge")
struct IdentityMergeTests {
    private static let token = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"

    @Test("reads the token out of an inbound url and ignores links without one")
    func parsesTheToken() {
        #expect(IdentityMerge.parseToken("https://shop.example/p?fmt=\(Self.token)") == Self.token)
        #expect(
            IdentityMerge.parseToken("https://shop.example/p?fCtx=abc&fmt=\(Self.token)&utm_source=frak")
                == Self.token
        )
        #expect(IdentityMerge.parseToken("https://shop.example/p?fCtx=abc") == nil)
        #expect(IdentityMerge.parseToken("https://shop.example/p?fmt=") == nil)
        #expect(IdentityMerge.parseToken("not-a-url") == nil)
    }

    @Test("claim burns a token once")
    func claimBurnsOnce() async {
        let merge = IdentityMerge(logger: FrakLogger(level: .none))
        #expect(await merge.claim(Self.token))
        #expect(await merge.claim(Self.token) == false)
    }

    @Test("claim refuses an empty token")
    func claimRefusesEmpty() async {
        let merge = IdentityMerge(logger: FrakLogger(level: .none))
        #expect(await merge.claim("") == false)
    }
}
