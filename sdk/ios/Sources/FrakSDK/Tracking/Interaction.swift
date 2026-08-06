// Struct over a closed set of shapes (not a bare enum) so each factory can default
// fields a caller almost never sets. Matches the three shapes POST /user/track/interaction accepts.
//
// Android matches this shape as of `09-android-api-surface.md` §4 — it used to expose a
// `sealed interface` with three publicly-constructible classes, which made adding a fourth wire shape
// a break for any consumer who had written an exhaustive `when`. That was finding 9.8. Two residual
// differences, both deliberate: Android spells `arrival`'s four fields out (it has no default
// arguments anywhere on its surface, because a Kotlin default freezes an arity in the ABI), and it
// carries an explicit `sharing(purchaseId:)` overload where the label plus a default gives it here.
public struct Interaction: Sendable, Hashable {
    enum Kind: Sendable, Hashable {
        case arrival(
            referrerWallet: String?,
            referrerClientId: String?,
            referrerMerchantId: String?,
            referralTimestamp: Int64?
        )
        case sharing(sharingTimestamp: Int64?, purchaseId: String?)
        case custom(customType: String, data: [String: String], idempotencyKey: String?)
    }

    let kind: Kind

    // Built for you by FrakClient.appLink.handleReferral(_:).
    public static func arrival(
        referrerWallet: String? = nil,
        referrerClientId: String? = nil,
        referrerMerchantId: String? = nil,
        referralTimestamp: Int64? = nil
    ) -> Interaction {
        Interaction(
            kind: .arrival(
                referrerWallet: referrerWallet,
                referrerClientId: referrerClientId,
                referrerMerchantId: referrerMerchantId,
                referralTimestamp: referralTimestamp
            )
        )
    }

    // sharingTimestamp nil is stamped at capture, so a retry later still reports when shared.
    public static func sharing(sharingTimestamp: Int64? = nil, purchaseId: String? = nil) -> Interaction {
        Interaction(kind: .sharing(sharingTimestamp: sharingTimestamp, purchaseId: purchaseId))
    }

    // idempotencyKey only worth supplying if the caller can reproduce it across restarts.
    public static func custom(
        _ customType: String,
        data: [String: String] = [:],
        idempotencyKey: String? = nil
    ) -> Interaction {
        Interaction(kind: .custom(customType: customType, data: data, idempotencyKey: idempotencyKey))
    }
}
