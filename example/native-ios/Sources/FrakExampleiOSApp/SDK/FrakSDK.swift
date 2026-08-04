import Foundation

/// ⚠️ SCAFFOLDING — this is not the Frak iOS SDK.
///
/// The real SDK does not exist yet. This file exists only so the example app's
/// views have a shape to compile against, and it deliberately implements
/// **nothing**: every call logs and returns.
///
/// Earlier revisions prototyped anonymous-id persistence, `fCtx` parsing and the
/// self-referral guard here. That logic was removed rather than kept: it is real
/// SDK behaviour, it was written twice in two languages with nothing asserting
/// the two agreed, and none of it survives into the real SDK — which derives a
/// keypair rather than persisting a UUID, and whose invariants are pinned by the
/// shared golden-fixture corpus. Prototyping it in a harness that runs no
/// fixtures proved nothing and could only drift.
///
/// What this app can still exercise is real: that `CFBundleURLTypes` registers,
/// that an inbound URL reaches `onOpenURL`, and that the views drive the loop
/// through a public surface only.
///
/// Delete this file once the real artifact ships.

public enum DeepLinkHandling {
    case automatic
    case manual
    case disabled
}

public struct FrakConfig {
    public let merchantId: String
    public let deepLink: DeepLinkHandling
    public let environment: String

    public init(
        merchantId: String,
        deepLink: DeepLinkHandling = .automatic,
        environment: String = "production"
    ) {
        self.merchantId = merchantId
        self.deepLink = deepLink
        self.environment = environment
    }
}

public struct ProductItem: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let link: String
    public let estimatedRewardCents: Int64

    public init(id: String, title: String, link: String, estimatedRewardCents: Int64) {
        self.id = id
        self.title = title
        self.link = link
        self.estimatedRewardCents = estimatedRewardCents
    }
}

public struct SharingRequest {
    public let productId: String
    public let productName: String
    public let estimatedRewardCents: Int64
    public let products: [ProductItem]

    public init(productId: String, productName: String, estimatedRewardCents: Int64, products: [ProductItem] = []) {
        self.productId = productId
        self.productName = productName
        self.estimatedRewardCents = estimatedRewardCents
        self.products = products
    }
}

public enum SharingResult {
    case shared
    case copied
    case installed
    case dismissed
    case failed(FrakError)
}

public enum FrakError: Error, Equatable {
    case alreadyPresenting
    case networkError
    case unknown(String)
}

/// No `currency` field: the harness renders a hardcoded `$` and the sample data is
/// not USD, so carrying one here would only assert something untrue. Currency comes
/// from the real SDK's static config.
public struct PurchaseDetails {
    public let orderId: String
    public let amountInCents: Int64

    public init(orderId: String, amountInCents: Int64) {
        self.orderId = orderId
        self.amountInCents = amountInCents
    }
}

@MainActor
public final class FrakClient {
    public static let shared = FrakClient()

    private static let notImplemented = "no SDK: sdk/ios does not exist yet"

    private init() {}

    public func initialize(config: FrakConfig) {
        print("[FrakSDK] initialize(merchantId: \(config.merchantId)) — \(Self.notImplemented)")
    }

    /// The real SDK presents a native sheet hosting `/sharing?native=1` and
    /// resolves on the `?confirmed=1` return channel. Nothing is presented here,
    /// so the result is a failure rather than a fabricated success — a harness
    /// reporting "shared successfully" without a sheet is worse than one that
    /// reports the truth.
    public func presentSharing(
        request: SharingRequest,
        completion: @escaping (SharingResult) -> Void
    ) {
        print("[FrakSDK] presentSharing(productId: \(request.productId)) — \(Self.notImplemented)")
        completion(.failed(.unknown(Self.notImplemented)))
    }

    public func trackPurchase(_ details: PurchaseDetails) {
        print("[FrakSDK] trackPurchase(orderId: \(details.orderId)) — \(Self.notImplemented)")
    }

    /// The real SDK parses `fCtx` case-insensitively, decodes the v2 binary
    /// payload and applies the self-referral guard. None of that happens here,
    /// so the URL is logged verbatim and nothing is returned.
    public func handleReferralLink(_ url: URL) {
        print("[FrakSDK] handleReferralLink(\(url)) — \(Self.notImplemented)")
    }
}
