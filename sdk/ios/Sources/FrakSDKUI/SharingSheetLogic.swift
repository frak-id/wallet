import CoreGraphics
import Foundation
import FrakSDK

/// The resolved share payload the page reports on `action=share`. Every field optional and
/// independently absent — see docs/plans/native-sdk/10-native-share-payload.md §6.
///
/// `rect`, the Share CTA's viewport rect for the iPad popover anchor, is CSS pixels; treated
/// as 1:1 with `WKWebView` points, which holds only because the hosted page pins
/// `viewport-fit`/`initial-scale=1` and this sheet never lets the user pinch-zoom it.
struct SharingSharePayload: Hashable {
    let title: String?
    let text: String?
    let imageURL: URL?
    let rect: CGRect?
}

/// What the hosted page can tell the host, over the intercepted return-scheme navigation. Kept
/// outside the `#if canImport(UIKit)` files (unlike the `WKWebView` that reports it) so its wire
/// parsing runs in the host-toolchain test stage, not just the compile-only iOS-simulator one —
/// see `scripts/run.sh`'s `do_test`.
enum SharingPageAction: Hashable {
    case install
    case dismiss
    case shareAgain
    /// The page's own Share button — an ask, not a report: the host signs the interaction.
    case share(SharingSharePayload)
    case copy
    case error
    /// The page has painted. iOS's only paint signal: WebKit exposes no public
    /// `postVisualStateCallback`, and a fragment activation fires no `didFinish` at all.
    case ready
    case code(value: String, expiresAt: Date?)

    /// Payload-free discriminator for `SharingSheetModel.claimed`, which needs "is a share
    /// round trip already in flight", not "is this the exact same payload" — two taps in a
    /// row report different `rect`s and must still collide in the set.
    enum Kind: Hashable {
        case install, dismiss, shareAgain, share, copy, error, ready, code
    }

    var kind: Kind {
        switch self {
        case .install: .install
        case .dismiss: .dismiss
        case .shareAgain: .shareAgain
        case .share: .share
        case .copy: .copy
        case .error: .error
        case .ready: .ready
        case .code: .code
        }
    }

    /// Unknown actions are nil, not a failure: the page may ship one before the SDK reads it.
    static func from(
        action: String,
        value: String?,
        exp: String?,
        shareTitle: String? = nil,
        shareText: String? = nil,
        shareImage: String? = nil,
        shareRect: String? = nil
    ) -> SharingPageAction? {
        switch action {
        case "install": return .install
        case "dismiss": return .dismiss
        case "shareAgain": return .shareAgain
        case "share":
            return .share(
                SharingSharePayload(
                    title: nonEmpty(shareTitle),
                    text: nonEmpty(shareText),
                    imageURL: nonEmpty(shareImage).flatMap(sharingHTTPSImageURL),
                    rect: shareRect.flatMap(parseShareRect)
                )
            )
        case "copy": return .copy
        case "error": return .error
        case "ready": return .ready
        case "code":
            guard let value, !value.isEmpty else { return nil }
            // `Int64`, not `Double`: has to agree with Kotlin's `toLongOrNull`, which rejects
            // "NaN"/"inf".
            let expiresAt = exp.flatMap(Int64.init).map {
                Date(timeIntervalSince1970: TimeInterval($0))
            }
            return .code(value: value, expiresAt: expiresAt)
        default: return nil
        }
    }
}

/// An empty string is "absent", not "override with nothing" — the page already enforces this
/// on the way out; re-checked here because the query string is not otherwise trusted.
private func nonEmpty(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return value
}

/// Re-validated independently of the page's own https-only check: this SDK fetches the URL,
/// so a scheme downgrade here would be an SSRF vector the page's sanitizer cannot see.
private func sharingHTTPSImageURL(_ value: String) -> URL? {
    guard let url = URL(string: value), url.scheme == "https" else { return nil }
    return url
}

/// `x,y,w,h`, four finite CSS-pixel values with a positive width and height. Anything else —
/// missing a component, non-numeric, negative or zero size — answers nil so the caller falls
/// back to the centred anchor rather than pointing at a degenerate rect.
private func parseShareRect(_ value: String) -> CGRect? {
    let parts = value.split(separator: ",", omittingEmptySubsequences: false)
    guard parts.count == 4 else { return nil }
    let numbers = parts.compactMap { Double($0) }
    guard numbers.count == 4 else { return nil }
    let (x, y, w, h) = (numbers[0], numbers[1], numbers[2], numbers[3])
    guard [x, y, w, h].allSatisfy(\.isFinite), w > 0, h > 0 else { return nil }
    return CGRect(x: x, y: y, width: w, height: h)
}

/// https-only, and no private/link-local target: the app's own network position is not ours to
/// lend to a URL this SDK did not choose, which either the hosted page or a merchant did. Kept
/// outside the `#if canImport(UIKit)` `SharingImagePreview` for the same host-testability reason
/// as `SharingPageAction` above.
func isFetchableShareImageURL(_ url: URL) -> Bool {
    guard url.scheme == "https", let host = url.host?.lowercased(), !host.isEmpty else { return false }
    if host.hasSuffix(".local") { return false }
    if let address = IPv4Address(host) { return !address.isPrivateOrLinkLocal }
    return true
}

/// Just enough of RFC 1918 / RFC 3927 to keep this SDK from being handed a URL that makes the
/// merchant's app fetch its own internal network. Hostnames only reach here after `URL` has
/// already rejected anything that is not a valid authority.
struct IPv4Address {
    let octets: (UInt8, UInt8, UInt8, UInt8)

    init?(_ host: String) {
        let parts = host.split(separator: ".")
        guard parts.count == 4 else { return nil }
        let values = parts.compactMap { UInt8($0) }
        guard values.count == 4 else { return nil }
        octets = (values[0], values[1], values[2], values[3])
    }

    var isPrivateOrLinkLocal: Bool {
        switch octets {
        case (10, _, _, _): return true
        case (172, let second, _, _) where (16...31).contains(second): return true
        case (192, 168, _, _): return true
        case (169, 254, _, _): return true
        case (127, _, _, _): return true
        default: return false
        }
    }
}

/// The share, resolved once before anything can be shown.
///
/// `link` is built locally and works offline; `pageURL` needs the network and can legitimately
/// be absent while `link` is not — that's what the native-share fallback fires from.
struct SharingSession: Equatable {
    let walletOrigin: String
    let returnScheme: String
    let link: String
    /// The chooser's fallback title/text/image, used only if `fallBack(to:)` fires — a session
    /// with a hosted page gets its OS-share copy from the page's own `action=share` instead.
    let shareTitle: String?
    let shareText: String?
    let shareImageURL: String?
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
        shareText: String? = nil,
        shareImageURL: String? = nil,
        pageURL: String?,
        warmBaseURL: String? = nil,
        activationFragment: String? = nil
    ) {
        self.walletOrigin = walletOrigin
        self.returnScheme = returnScheme
        self.link = link
        self.shareTitle = shareTitle
        self.shareText = shareText
        self.shareImageURL = shareImageURL
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

/// Where a link the hosted page handed out should go.
enum SharingExternalRoute: Equatable {
    /// Not http(s), so it is an app-to-app launch the merchant never sanctioned.
    case ignore
    /// The wallet's own App Store listing. The caller decides between a deep link and the
    /// store overlay — that needs a probe this cannot make.
    case walletStoreListing
    /// Anything else the page linked to.
    case openURL(URL)
}

/// Classifies an outbound link from the sharing/install page.
func sharingExternalRoute(_ url: URL) -> SharingExternalRoute {
    // Case-insensitive, like Android's `normalizeScheme()`: `URL` keeps whatever case the page
    // wrote, and an exact compare would silently drop a legitimate `HTTPS:` link.
    let scheme = url.scheme?.lowercased()
    guard scheme == "https" || scheme == "http" else { return .ignore }
    return isAppStoreListing(url) ? .walletStoreListing : .openURL(url)
}

/// Any App Store listing on `apps.apple.com`, deliberately not matched on the wallet's id: the
/// overlay is always raised with the wallet's own id, so the URL only has to say "store listing".
/// Matching the id would tie a constant frozen at submission to a page served live.
///
/// Scans path components, so storefront-prefixed forms like `/us/app/name/id123` match.
func isAppStoreListing(_ url: URL) -> Bool {
    guard url.host?.caseInsensitiveCompare("apps.apple.com") == .orderedSame else { return false }
    return url.pathComponents.contains { component in
        guard component.hasPrefix("id") else { return false }
        let digits = component.dropFirst(2)
        return !digits.isEmpty && digits.allSatisfy(\.isNumber)
    }
}

/// Whether a finished OS chooser counts as a share.
///
/// `completed` is the share extension's own claim and is wrong in both directions in the wild;
/// `activityType` is UIKit's, and is nil only when the sheet was dismissed without picking a
/// target. Either one counts, which still keeps a cancelled chooser out.
///
/// - Parameters:
///   - activityType: `UIActivity.ActivityType.rawValue`, or nil when nothing was picked.
///   - completed: the extension's own claim.
///   - failed: whether the handler carried an error.
/// - Returns: whether to attribute and confirm this chooser as a share.
func sharingChooserCompleted(activityType: String?, completed: Bool, failed: Bool) -> Bool {
    guard !failed else { return false }
    return completed || activityType != nil
}

/// What `SharingWebViewPool` should do with a view a closing sheet just handed back.
enum SharingReclaim: Equatable {
    /// Never warmed, so there is nothing to put back — just stop the closed session reporting.
    case park
    /// Still the document the pool warmed, so the session moved only its params: put those back
    /// as a fragment and the engine keeps its booted page for the next sheet.
    case resetInPlace
    /// The document itself moved — a full session load, or the install page — so it has to be
    /// loaded again before it is warm.
    case reload(String)
}

/// Which reset a released view needs.
///
/// Gated on exactly the pair `SharingPresentation` activates on: an unfinished document has
/// nothing to hang a fragment off, and a document that is not the warm one is not the page a reset
/// would put back. Wrong in either direction is quiet — stale params on screen, or a full page
/// load between every sheet.
func sharingReclaim(
    warmURL: String?,
    loadedBaseURL: String?,
    documentReady: Bool
) -> SharingReclaim {
    guard let warmURL else { return .park }
    if documentReady, loadedBaseURL == warmURL { return .resetInPlace }
    return .reload(warmURL)
}

/// What the OS share sheet says when there is no hosted page to ask — either config resolution
/// failed outright, or a page that did resolve never loaded before the tap-to-content deadline.
/// Native never reads `sdkConfig.translations` on this path (`FrakResolvedConfig` may not even be
/// available), so the chain is local-only: docs/plans/native-sdk/10-native-share-payload.md §7.
struct Tier3ShareData: Equatable {
    let title: String
    let text: String
}

/// Bundled `sharing.title`/`sharing.text` defaults, mirrored from
/// `packages/wallet-shared/src/i18n/locales/{en,fr}/common.json`. Kept in step by hand — there is
/// no shared fixture for prose copy the way there is for the wire formats (`04-golden-fixtures.md`
/// covers codecs, not translations). A `switch`, not a dictionary: `FrakLanguage`'s `CaseIterable`
/// conformance makes this exhaustive, so a third case fails the build here instead of degrading a
/// share to a missing-key lookup at runtime.
private func tier3Defaults(for lang: FrakLanguage) -> Tier3ShareData {
    switch lang {
    case .en:
        Tier3ShareData(title: "{{productName}} invite link", text: "Discover this amazing product!")
    case .fr:
        Tier3ShareData(title: "Lien d'invitation {{productName}}", text: "Découvrez ce produit incroyable !")
    }
}

/// Per-call override, then the first product's title, then the bundled default for `lang` (`en`
/// when `lang` is nil). `{{productName}}` interpolates from `productName`, which is nil when
/// `FrakMetadata.name` was never set — the placeholder is dropped rather than left showing `{{}}`.
func tier3ShareData(
    request: SharingRequest,
    productName: String?,
    lang: FrakLanguage?
) -> Tier3ShareData {
    let defaults = tier3Defaults(for: lang ?? .en)
    let fallbackTitle = request.products.first?.title
    return Tier3ShareData(
        title: interpolateProductName(request.shareTitle ?? fallbackTitle ?? defaults.title, productName),
        text: interpolateProductName(request.shareText ?? defaults.text, productName)
    )
}

/// Drops the placeholder entirely when there is no name, rather than rendering an empty gap.
/// The whitespace on either side of it collapses too, so "Discover !" cannot happen.
private func interpolateProductName(_ template: String, _ productName: String?) -> String {
    guard let productName else {
        return
            template
            .replacingOccurrences(of: " {{productName}}", with: "")
            .replacingOccurrences(of: "{{productName}} ", with: "")
            .replacingOccurrences(of: "{{productName}}", with: "")
            .trimmingCharacters(in: .whitespaces)
    }
    return template.replacingOccurrences(of: "{{productName}}", with: productName)
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

/// Waits between attempts at building the session, when the failure looks transient: the build is
/// the only step with no fallback, and a throwing one closes the sheet outright.
let sharingBuildRetryDelays: [TimeInterval] = [0.25, 0.75]

/// Whether a failed session build is worth another attempt.
///
/// Narrow on purpose, and closed rather than defaulted-open: a misconfiguration retried three
/// times is three times the wait for the same answer, and a kind added later is more likely to be
/// one of those than a blip.
func sharingBuildIsWorthRetrying(_ error: FrakError) -> Bool {
    switch error.kind {
    // `merchantResolutionFailed` is what a cold start reports when the identity mint or the
    // merchant resolve has not landed yet — the case this ladder exists for.
    case .network, .server, .backingOff, .decoding, .merchantResolutionFailed, .internalFailure:
        return true
    default:
        return false
    }
}

/// Tunable defaults for `FrakSharingConfiguration`. `heightFraction` is mirrored on the other
/// platform; keep both in step. `install` is iOS-only.
public enum FrakSharingDefaults {
    public static let heightFraction: CGFloat = 0.85

    /// The store page, not the overlay: it reports whether it drew, it can be styled through a
    /// custom product page, and it hands the sheet back when the user closes it.
    public static let install: FrakInstallPresentation = .storeProductPage

    /// Follows the opt-in `isFrakAppInstalled()` already requires; see `FrakSharingConfiguration`.
    public static let detectInstall = true
}

/// The range a caller-supplied `heightFraction` is clamped into.
let sharingHeightFractionRange: ClosedRange<CGFloat> = 0.3...1.0

/// Clamps a merchant-supplied `heightFraction` into `sharingHeightFractionRange`. A non-finite
/// input answers the default, since `min`/`max` treat NaN as out of range without signalling.
func clampedSharingHeightFraction(_ fraction: CGFloat) -> CGFloat {
    guard fraction.isFinite else { return FrakSharingDefaults.heightFraction }
    return min(max(fraction, sharingHeightFractionRange.lowerBound), sharingHeightFractionRange.upperBound)
}
