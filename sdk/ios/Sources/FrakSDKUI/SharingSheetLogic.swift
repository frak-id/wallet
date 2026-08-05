import CoreGraphics
import Foundation
import FrakSDK

/// The share, resolved once before anything can be shown.
///
/// `link` is built locally by `FrakClient.sharing.buildLink` and works offline. `pageURL`
/// needs the network and can legitimately be absent while `link` is not — that's what the
/// native-share fallback fires from.
struct SharingSession: Equatable {
    let walletOrigin: String
    let returnScheme: String
    /// The share link itself. Usable even when `pageURL` is not.
    let link: String
    let shareTitle: String?
    private let pageURL: String?

    init(walletOrigin: String, returnScheme: String, link: String, shareTitle: String?, pageURL: String?) {
        self.walletOrigin = walletOrigin
        self.returnScheme = returnScheme
        self.link = link
        self.shareTitle = shareTitle
        self.pageURL = pageURL
    }

    /// Nil when the hosted page could not be resolved — see the type's doc.
    func url(confirmed: Bool) -> URL? {
        pageURL.flatMap { URL(string: confirmed ? $0 + "&confirmed=1" : $0) }
    }
}

/// What the sheet should do next.
enum SharingDecision: Equatable {
    /// Tier 1: show the hosted page.
    case showPage(URL)
    /// Tier 3: skip the page, open the OS share sheet on this session's local link.
    case nativeShare(SharingSession)
    /// Nothing to do: already shown, already fallen back, closed, or no session built yet.
    case doNothing
}

/// The tier choice, as one predicate. Lives outside `#if canImport(UIKit)` so it is reachable
/// from the macOS test host, which cannot compile the model that calls it.
///
/// `deadlineExpired` means the 1.5s tap-to-content budget is gone. A nil `session` is not a
/// separate answer: `prepare` is still running and will decide when it returns.
func sharingDecision(
    session: SharingSession?,
    deadlineExpired: Bool,
    pageLoaded: Bool,
    fellBack: Bool,
    closed: Bool
) -> SharingDecision {
    if fellBack || closed || pageLoaded { return .doNothing }
    guard let session else { return .doNothing }
    guard !deadlineExpired, let url = session.url(confirmed: false) else { return .nativeShare(session) }
    return .showPage(url)
}

/// The `products=` value the hosted sharing page's router parses as JSON. Nil rather than
/// `[]`: the page skips the card section on an absent value, renders an empty one on `[]`.
///
/// Flattens `SharingProduct.details` alongside the render fields, matching `sdk/core`'s
/// `SharingPageProduct`. Mirrored in `SharingSheetState.productsJson` on Android; keep both
/// in step.
///
/// Outside `SharingSheetModel`'s `#if canImport(UIKit)` so a macOS test host can pin what
/// reaches the page.
func sharingPageProductsJSON(_ products: [SharingProduct]) -> String? {
    guard !products.isEmpty else { return nil }
    let array = products.map { product -> [String: Any] in
        let details = product.details
        let fields: [String: Any?] = [
            "title": product.title,
            "link": product.link,
            "imageUrl": product.imageURL,
            "utmContent": product.utmContent,
            "productId": details?.productId,
            "sku": details?.sku,
            "name": details?.name,
            // `flatMap`, not `map`: the formatter returns nil for a non-finite value, and a nested
            // `.some(.none)` would survive `compactMapValues` and fail the whole serialization.
            "quantity": details?.quantity.flatMap(sharingPageJSONNumber),
            "unitPrice": details?.unitPrice.flatMap(sharingPageJSONNumber),
            "totalPrice": details?.totalPrice.flatMap(sharingPageJSONNumber),
        ]
        return fields.compactMapValues { $0 }
    }
    guard let data = try? JSONSerialization.data(withJSONObject: array, options: [.sortedKeys]) else {
        return nil
    }
    return String(data: data, encoding: .utf8)
}

/// A `Double` that `JSONSerialization` will print the way `JSON.stringify` does.
///
/// Passed straight through, `JSONSerialization` prints a `Double` at full binary precision:
/// `79.9` reaches the page as `79.900000000000006` and fails an `eq` scope comparison Android
/// wins. `Double.description` is Swift's round-trip-minimal formatter; `NSDecimalNumber`
/// carries that text through serialization. The trailing `.0` is dropped to match
/// `JSON.stringify`, which never emits one for an integral number.
///
/// Nil for NaN/Infinity, which have no JSON literal — `JSONSerialization` would otherwise
/// fail the whole array.
private func sharingPageJSONNumber(_ value: Double) -> NSDecimalNumber? {
    guard value.isFinite else { return nil }
    // `-0.0` would leave as "-0"; `JSON.stringify(-0)` writes "0" and Android agrees.
    guard value != 0 else { return NSDecimalNumber.zero }
    var text = value.description
    if text.hasSuffix(".0") { text.removeLast(2) }
    return NSDecimalNumber(string: text)
}

/// Tunable defaults for `View.frakSharingSheet(isPresented:request:heightFraction:onResult:)`.
public enum FrakSharingDefaults {
    /// The default fraction of the screen the sharing sheet takes.
    ///
    /// Mirrors `FrakSharingDefaults.HEIGHT_FRACTION` on Android — keep both in step.
    public static let heightFraction: CGFloat = 0.85
}

/// The range a caller-supplied `heightFraction` is clamped into: below it the hosted page
/// would be clipped to something unusably small; above it the sheet could exceed the screen.
let sharingHeightFractionRange: ClosedRange<CGFloat> = 0.3...1.0

/// Clamps a merchant-supplied `heightFraction` into `sharingHeightFractionRange`.
///
/// A non-finite input (NaN, ±infinity) answers the default rather than propagating into a
/// `.frame(height:)` SwiftUI would refuse to lay out — `min`/`max` treat NaN as out of range
/// without signalling it, so this is checked explicitly. Lives outside `#if canImport(UIKit)`
/// so the clamp is exercised on the macOS test host.
func clampedSharingHeightFraction(_ fraction: CGFloat) -> CGFloat {
    guard fraction.isFinite else { return FrakSharingDefaults.heightFraction }
    return min(max(fraction, sharingHeightFractionRange.lowerBound), sharingHeightFractionRange.upperBound)
}
