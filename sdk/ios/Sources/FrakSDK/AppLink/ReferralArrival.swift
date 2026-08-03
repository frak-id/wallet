import Foundation

enum ReferralArrival {
    // Must be checked before tracking any arrival. Ignores two shapes of inbound context:
    // - a self-referral: this device's own anonymousId as the link's clientId, or a
    //   reopened/reshared own link gets recorded as a self-referral. v1 links carry no
    //   anonymous id to compare.
    // - a foreign-merchant referral: a v2 context whose merchantId is not ownMerchantId. v1
    //   carries no merchantId at all, so this guard cannot apply to it — a v1 link from any
    //   merchant is still tracked as this merchant's arrival. That bypass is open, see 3.2 in
    //   06-open-findings.md.
    //
    // ownMerchantId is best-effort (the cached config, not a fresh resolve, since arrival
    // handling is fire-and-forget and must not block on network): nil means "unknown", which
    // lets the context through rather than discard telemetry the SDK hasn't resolved its own
    // merchant for yet.
    //
    // The merchant-id comparison is case-insensitive and trims whitespace: ownMerchantId comes
    // from either the merchant's own free-typed FrakConfig.merchantId or the backend's canonical
    // form, context.merchantId was minted by (possibly another build of) this same merchant's
    // app — an exact-match compare would silently drop genuine referrals on nothing more than a
    // casing difference.
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

    private static func sameMerchant(_ a: String, _ b: String) -> Bool {
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
