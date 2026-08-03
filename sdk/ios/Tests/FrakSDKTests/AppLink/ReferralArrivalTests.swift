import Testing

@testable import FrakSDK

@Suite("ReferralArrival")
struct ReferralArrivalTests {
    private static let merchantId = "550e8400-e29b-41d4-a716-446655440000"
    private static let clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    private static let otherClientId = "550e8400-e29b-41d4-a716-446655440001"
    private static let otherMerchantId = "550e8400-e29b-41d4-a716-446655440002"
    private static let wallet = "0x1234567890123456789012345678901234567890"
    private static let timestamp: Int64 = 1_709_654_400

    @Test("treats a link this device produced as a self-referral")
    func detectsASelfReferral() {
        let own = FrakContext.v2(
            FrakContext.V2(merchantId: Self.merchantId, timestamp: Self.timestamp, clientId: Self.clientId)
        )
        #expect(ReferralArrival.shouldIgnoreArrival(own, anonymousId: Self.clientId))
    }

    @Test("treats someone else's link as a referral")
    func acceptsSomeoneElsesLink() {
        let other = FrakContext.v2(
            FrakContext.V2(merchantId: Self.merchantId, timestamp: Self.timestamp, clientId: Self.otherClientId)
        )
        #expect(!ReferralArrival.shouldIgnoreArrival(other, anonymousId: Self.clientId))
    }

    @Test("cannot self-refer with no identity, or from a v1 link")
    func cannotSelfReferWithoutAnIdentity() {
        let context = FrakContext.v2(
            FrakContext.V2(merchantId: Self.merchantId, timestamp: Self.timestamp, clientId: Self.clientId)
        )
        #expect(!ReferralArrival.shouldIgnoreArrival(context, anonymousId: nil))
        #expect(!ReferralArrival.shouldIgnoreArrival(.v1(wallet: Self.wallet), anonymousId: Self.clientId))
    }

    @Test("ignores a v2 link minted for a different merchant, even from another device")
    func ignoresAForeignMerchantLink() {
        let foreign = FrakContext.v2(
            FrakContext.V2(merchantId: Self.otherMerchantId, timestamp: Self.timestamp, clientId: Self.otherClientId)
        )
        #expect(
            ReferralArrival.shouldIgnoreArrival(foreign, anonymousId: Self.clientId, ownMerchantId: Self.merchantId)
        )
    }

    @Test("lets a v2 link through when this SDK instance has not resolved its own merchant yet")
    func letsALinkThroughWithNoKnownOwnMerchant() {
        let other = FrakContext.v2(
            FrakContext.V2(merchantId: Self.otherMerchantId, timestamp: Self.timestamp, clientId: Self.otherClientId)
        )
        #expect(!ReferralArrival.shouldIgnoreArrival(other, anonymousId: Self.clientId, ownMerchantId: nil))
    }

    @Test("carries every field a v2 context knows into the arrival")
    func carriesEveryV2Field() throws {
        let arrival = ReferralArrival.arrival(
            from: .v2(
                FrakContext.V2(
                    merchantId: Self.merchantId,
                    timestamp: Self.timestamp,
                    clientId: Self.otherClientId,
                    wallet: Self.wallet
                )
            )
        )
        guard case .arrival(let referrerWallet, let referrerClientId, let referrerMerchantId, let at) = arrival.kind
        else {
            Issue.record("expected an arrival")
            return
        }
        #expect(referrerWallet == Self.wallet)
        #expect(referrerClientId == Self.otherClientId)
        #expect(referrerMerchantId == Self.merchantId)
        #expect(at == Self.timestamp)
    }

    @Test("carries only the wallet from a v1 context")
    func carriesOnlyTheWalletFromV1() throws {
        let arrival = ReferralArrival.arrival(from: .v1(wallet: Self.wallet))
        guard case .arrival(let referrerWallet, _, let referrerMerchantId, let at) = arrival.kind else {
            Issue.record("expected an arrival")
            return
        }
        #expect(referrerWallet == Self.wallet)
        #expect(referrerMerchantId == nil)
        #expect(at == nil)
    }
}
