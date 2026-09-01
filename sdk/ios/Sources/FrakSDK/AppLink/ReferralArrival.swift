import Foundation

enum ReferralArrival {
    // Must be checked before tracking any arrival. Ignores a self-referral (this device's own
    // anonymousId as the link's clientId) and a foreign-merchant v2 context. A v1 link carries
    // neither field, so neither guard applies to it — that gap is known and still open.
    //
    // ownMerchantId is best-effort, from the cached config: nil means "unknown" and lets the
    // context through. Compared case-insensitively, or a casing difference drops a real referral.
    static func shouldIgnoreArrival(
        _ context: FrakContext,
        anonymousId: String?,
        ownMerchantId: String? = nil
    ) -> Bool {
        switch context {
        // No merchantId on a v1 context to compare against ownMerchantId — see the doc above.
        case .v1: false
        case .v2(let context):
            (anonymousId != nil && context.clientId == anonymousId)
                || (ownMerchantId.map { !Self.sameMerchant(context.merchantId, $0) } ?? false)
        }
    }

    static func sameMerchant(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespaces).caseInsensitiveCompare(b.trimmingCharacters(in: .whitespaces))
            == .orderedSame
    }

    static func arrival(from context: FrakContext) -> Interaction {
        switch context {
        case .v1(let wallet):
            .arrival(referrerWallet: wallet)
        case .v2(let context):
            .arrival(
                referrerWallet: context.wallet,
                referrerClientId: context.clientId,
                referrerMerchantId: context.merchantId,
                referralTimestamp: context.timestamp
            )
        }
    }
}
