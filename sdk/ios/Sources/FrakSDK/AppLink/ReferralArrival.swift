enum ReferralArrival {
    // Must be checked before tracking any arrival, or a reopened/reshared own link
    // gets recorded as a self-referral. v1 links carry no anonymous id to compare.
    static func isSelfReferral(_ context: FrakContext, anonymousId: String?) -> Bool {
        switch context {
        case .v1: false
        case .v2(let context): anonymousId != nil && context.clientId == anonymousId
        }
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
