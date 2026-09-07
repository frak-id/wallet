import Foundation

/// Encodes `[ProductDetails]` for the `products` query parameter of
/// `GET /user/merchant/estimated-rewards`: `base64url(utf8(JSON.stringify(...)))`, identical
/// to `sdk/core`'s `compressJsonToB64` (`sdk/core/src/utils/compression/compress.ts`) despite
/// the name — it is encoding, not compression. Kept beside `RewardRepository`, the only
/// caller; this is not the `products=` parameter the hosted sharing page reads (see
/// `FrakSDKUI/SharingSheetModel.productsJSON`), which stays plain JSON for the page's router.
enum ProductDetailsQueryEncoder {
    /// Above this, the parameter is dropped rather than sent — see `encode(_:logger:)`.
    static let maxEncodedLength = 8192

    /// `nil` when `products` is empty, every entry has no non-null scope field, or the
    /// encoded form would exceed `maxEncodedLength`. Advisory reward context must degrade to
    /// unscoped selection, never fail or truncate a request.
    static func encode(_ products: [ProductDetails], logger: FrakLogger) -> String? {
        let objects = products.compactMap(fieldsJSON(for:))
        guard !objects.isEmpty else { return nil }

        let json = "[" + objects.joined(separator: ",") + "]"
        let encoded = Base64URL.encode(Data(json.utf8))

        guard encoded.count <= maxEncodedLength else {
            logger.warn(
                "Frak: product context (\(encoded.count) chars) exceeds the \(maxEncodedLength)-char budget; "
                    + "sending the reward request unscoped."
            )
            return nil
        }
        return encoded
    }

    /// One object's JSON text, keys alphabetical (`name`, `productId`, `quantity`, `sku`,
    /// `totalPrice`, `unitPrice`) to match `sdk/core`'s output. `nil` when every field is nil,
    /// so a scope-only product with nothing set contributes no entry rather than an empty `{}`.
    ///
    /// Hand-assembled rather than `JSONSerialization`: that API round-trips a `Double` through
    /// `NSNumber`, reintroducing binary floating-point noise `JSON.stringify` never emits —
    /// `79.9` comes back as `79.900000000000006`. `Double.description` is Swift's own
    /// round-trip-minimal formatter; stripping its trailing `.0` is enough to match it exactly.
    private static func fieldsJSON(for product: ProductDetails) -> String? {
        var fields: [(key: String, value: String)] = []
        if let name = product.name { fields.append(("name", jsonString(name))) }
        if let productId = product.productId { fields.append(("productId", jsonString(productId))) }
        // `isFinite`: NaN/Infinity have no JSON literal, and `description` would write `nan`/`inf`
        // and make the payload unparseable. Dropping the field lands where `JSON.stringify` does
        // — it writes `null`, which the backend's `sanitizeProductDetailsList` discards anyway.
        if let quantity = product.quantity, quantity.isFinite {
            fields.append(("quantity", jsonNumber(quantity)))
        }
        if let sku = product.sku { fields.append(("sku", jsonString(sku))) }
        if let totalPrice = product.totalPrice, totalPrice.isFinite {
            fields.append(("totalPrice", jsonNumber(totalPrice)))
        }
        if let unitPrice = product.unitPrice, unitPrice.isFinite {
            fields.append(("unitPrice", jsonNumber(unitPrice)))
        }
        guard !fields.isEmpty else { return nil }
        return "{" + fields.map { "\"\($0.key)\":\($0.value)" }.joined(separator: ",") + "}"
    }

    /// Delegates escaping to `JSONSerialization` rather than hand-rolling it: string values are
    /// merchant/catalog data (product names), and that is exactly the class of input `\"`, `\\`
    /// and control characters can turn up in.
    private static func jsonString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value]),
            let array = String(data: data, encoding: .utf8)
        else {
            return "\"\""
        }
        // `[value]` always serialises as exactly `["<escaped>"]`.
        return String(array.dropFirst().dropLast())
    }

    private static func jsonNumber(_ value: Double) -> String {
        // `-0.0` reaches `description` as "-0.0" and would leave as "-0"; `JSON.stringify(-0)`
        // writes "0", and Kotlin's integral path agrees. Only this one value needs the guard.
        guard value != 0 else { return "0" }
        let description = value.description
        return description.hasSuffix(".0") ? String(description.dropLast(2)) : description
    }
}
