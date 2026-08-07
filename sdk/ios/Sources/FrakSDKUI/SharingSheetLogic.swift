import CoreGraphics
import Foundation
import FrakSDK

/// The share, resolved once before anything can be shown.
///
/// `link` is built locally and works offline; `pageURL` needs the network and can legitimately
/// be absent while `link` is not — that's what the native-share fallback fires from.
struct SharingSession: Equatable {
    let walletOrigin: String
    let returnScheme: String
    let link: String
    let shareTitle: String?
    private let pageURL: String?
    /// The warm URL this session's params can be hung off, when one exists. Compared against
    /// what the view is actually showing before any fragment is used.
    let warmBaseURL: String?
    private let activationFragment: String?

    init(
        walletOrigin: String,
        returnScheme: String,
        link: String,
        shareTitle: String?,
        pageURL: String?,
        warmBaseURL: String? = nil,
        activationFragment: String? = nil
    ) {
        self.walletOrigin = walletOrigin
        self.returnScheme = returnScheme
        self.link = link
        self.shareTitle = shareTitle
        self.pageURL = pageURL
        self.warmBaseURL = warmBaseURL
        self.activationFragment = activationFragment
    }

    /// Whether the hosted page is reachable at all. False is tier 3, not a broken session.
    var hasPage: Bool { pageURL != nil }

    /// How the view should get to this session's page, given what it is already showing.
    /// Nil when `hasPage` is false.
    func navigation(confirmed: Bool, currentBaseURL: String? = nil) -> SharingNavigation? {
        // Both answers derive from the same optional, so "no page" cannot be expressed as an
        // activation pointing at nothing.
        guard let full = url(confirmed: confirmed) else { return nil }
        if let warmBaseURL, let activationFragment, currentBaseURL == warmBaseURL {
            return .activate(
                fragment: confirmed ? activationFragment + "&view=confirmation" : activationFragment,
                fullURL: full
            )
        }
        return .load(full)
    }

    func url(confirmed: Bool) -> URL? {
        pageURL.flatMap { URL(string: confirmed ? $0 + "&view=confirmation" : $0) }
    }
}

/// How to get the page in front of the user.
///
/// A warmed document's URL is not the URL we warmed it on — the page's router normalises its
/// own search params on load — so activation must not compare against the warm URL.
enum SharingNavigation: Equatable {
    case load(URL)
    /// A fragment set on whatever document is loaded; `fullURL` is used only if the view has no
    /// committed URL to hang the fragment off.
    case activate(fragment: String, fullURL: URL)
}

/// What the sheet should do next.
enum SharingDecision: Equatable {
    /// Tier 1: show the hosted page, by whichever route is cheapest.
    case showPage(SharingNavigation)
    /// Tier 3: skip the page, open the OS share sheet on this session's local link.
    case nativeShare(SharingSession)
    case doNothing
}

/// The tier choice, as one predicate.
///
/// A nil `session` is not a separate answer: `prepare` is still running and will decide when it
/// returns. `currentBaseURL` is the finished warm document the view already holds, if any.
func sharingDecision(
    session: SharingSession?,
    deadlineExpired: Bool,
    pageLoaded: Bool,
    fellBack: Bool,
    closed: Bool,
    currentBaseURL: String? = nil
) -> SharingDecision {
    if fellBack || closed || pageLoaded { return .doNothing }
    guard let session else { return .doNothing }
    guard
        !deadlineExpired,
        let navigation = session.navigation(confirmed: false, currentBaseURL: currentBaseURL)
    else { return .nativeShare(session) }
    return .showPage(navigation)
}

/// Sequencing for `SharingSheetModel.abandon(onSettled:)` — see 9.1 in
/// `docs/plans/native-sdk/06-open-findings.md`. `share()`, `copy()` and `fallBack(to:)` are
/// independent, un-cancelled tasks that can outlive the sheet (freely, for `copy()`, since no OS
/// chooser covers it); a teardown with no better outcome must not report `.dismissed` while one
/// of them is still resolving, or the real outcome lands on a callback that has already been
/// nilled. `begin()`/`end()` bracket each of those calls; `abandon()` is the teardown asking
/// "can I report now, or does the last one still running have to do it for me".
///
/// Pure counting, extracted here (outside the `#if canImport(UIKit)` gate `SharingSheetModel`
/// lives behind) so this rule has a regression test that runs on the macOS test host — see
/// `SharingSheetModel.attributions` for why the model itself needs no locking around it either.
struct AttributionLedger: Equatable {
    private(set) var inFlight = 0
    private(set) var abandonRequested = false

    mutating func begin() {
        inFlight += 1
    }

    /// - Returns: true if this call is the one `abandon()` deferred to — the last attribution
    ///   standing when an abandon was already requested.
    @discardableResult
    mutating func end() -> Bool {
        inFlight -= 1
        return inFlight == 0 && abandonRequested
    }

    /// - Returns: true if the caller may report/tear down immediately; false means a later
    ///   `end()` will return true once, for whichever attribution is still in flight.
    mutating func abandon() -> Bool {
        abandonRequested = true
        return inFlight == 0
    }
}

/// The `products=` value the hosted sharing page's router parses as JSON. Nil rather than
/// `[]`: the page skips the card section on an absent value, renders an empty one on `[]`.
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
            // `flatMap`, not `map`: a nested `.some(.none)` would survive `compactMapValues`
            // and fail the whole serialization.
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
/// Passed straight through it prints at full binary precision (`79.9` becomes `79.900000000000006`), which fails
/// an `eq` product-scope comparison that Android wins. Nil for NaN/Infinity, which have no JSON literal.
private func sharingPageJSONNumber(_ value: Double) -> NSDecimalNumber? {
    guard value.isFinite else { return nil }
    // `-0.0` would leave as "-0"; `JSON.stringify(-0)` writes "0".
    guard value != 0 else { return NSDecimalNumber.zero }
    var text = value.description
    if text.hasSuffix(".0") { text.removeLast(2) }
    return NSDecimalNumber(string: text)
}

/// Tunable defaults for `View.frakSharingSheet(isPresented:request:heightFraction:onResult:)`. Mirrored on the
/// other platform; keep both in step.
public enum FrakSharingDefaults {
    public static let heightFraction: CGFloat = 0.85
}

/// The range a caller-supplied `heightFraction` is clamped into.
let sharingHeightFractionRange: ClosedRange<CGFloat> = 0.3...1.0

/// Clamps a merchant-supplied `heightFraction` into `sharingHeightFractionRange`. A non-finite
/// input answers the default, since `min`/`max` treat NaN as out of range without signalling.
func clampedSharingHeightFraction(_ fraction: CGFloat) -> CGFloat {
    guard fraction.isFinite else { return FrakSharingDefaults.heightFraction }
    return min(max(fraction, sharingHeightFractionRange.lowerBound), sharingHeightFractionRange.upperBound)
}
