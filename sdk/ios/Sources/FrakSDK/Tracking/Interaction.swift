// Struct over a closed set of shapes (not a bare enum) so each factory can default
// fields a caller almost never sets. Matches the three shapes POST /user/track/interaction accepts.
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
