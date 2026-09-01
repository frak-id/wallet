import Foundation

/// The purchase line-item fields a campaign's `productScope` can target.
///
/// Mirrors the backend's `PRODUCT_SCOPE_FIELDS` allowlist and `sdk/core`'s `ProductDetails`
/// exactly (`sdk/core/src/types/product.ts`) — a field outside this set cannot have been
/// published on a campaign, so adding one here without a matching backend change would be
/// dead weight.
///
/// `Double`, not `Int`, for every numeric: the wire type is a JSON number and the backend
/// compares numerically; an `Int` would silently truncate a fractional `unitPrice`.
///
/// Decoding lives on a private wire type in `RewardsDecoder.swift`: a synthesized `Decodable`
/// throws on a present-but-wrong-typed value even for an `Optional` property, which would let one
/// reshaped field inside `matchedProducts` take down the whole rewards response.
public struct ProductDetails: Sendable, Hashable {
    public let productId: String?
    public let sku: String?
    public let name: String?
    public let quantity: Double?
    public let unitPrice: Double?
    public let totalPrice: Double?

    public init(
        productId: String? = nil,
        sku: String? = nil,
        name: String? = nil,
        quantity: Double? = nil,
        unitPrice: Double? = nil,
        totalPrice: Double? = nil
    ) {
        self.productId = productId
        self.sku = sku
        self.name = name
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.totalPrice = totalPrice
    }
}
