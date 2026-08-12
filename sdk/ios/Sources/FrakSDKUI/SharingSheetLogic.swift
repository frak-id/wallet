import CoreGraphics
import Foundation
import FrakSDK

/// The share payload the page reports on `action=share`; every field independently optional.
struct SharingSharePayload: Hashable {
    let title: String?
    let text: String?
    let imageURL: URL?
}

/// What the hosted page can tell the host, over the intercepted return-scheme navigation. Kept
/// out of the UIKit-gated files so its wire parsing is reachable from the host-toolchain tests.
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

    /// Payload-free discriminator, so two taps in a row still collide as one in-flight share.
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
        shareImage: String? = nil
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
                    imageURL: nonEmpty(shareImage).flatMap(sharingHTTPSImageURL)
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

/// Mirrors the page-side share budget.
let shareTitleLimit = 120
let shareTextLimit = 280
let shareImageLimit = 512

extension String {
    /// Clips to `max`, ellipsis included in the budget.
    ///
    /// The budget counts UTF-16 units, matching the wire, but the cut lands on a grapheme
    /// boundary: slicing by unit alone splits a surrogate pair or strands a combining mark.
    func clippedForShare(to max: Int) -> String {
        guard utf16.count > max else { return self }

        let ellipsis = "…"
        let marked = max > ellipsis.utf16.count
        let budget = marked ? max - ellipsis.utf16.count : max
        var taken = ""
        var takenUnits = 0
        for cluster in self {
            let clusterUnits = String(cluster).utf16.count
            if takenUnits + clusterUnits > budget { break }
            taken.append(cluster)
            takenUnits += clusterUnits
        }
        guard marked else { return taken }
        while let last = taken.last, last.isWhitespace { taken.removeLast() }
        return taken + ellipsis
    }
}

/// What the OS chooser is handed: the link, the subject shown on both items, and the body as a
/// separate item so a single-item activity gets the link rather than text glued to a URL.
struct SharingShareItems: Equatable {
    let link: String
    let title: String?
    let text: String?
}

/// Applies the wire budget and the blank-is-absent rule once, before anything reaches the chooser.
func sharingShareItems(link: String, title: String?, text: String?) -> SharingShareItems {
    SharingShareItems(
        link: link,
        title: nonEmpty(title).map { $0.clippedForShare(to: shareTitleLimit) },
        text: nonEmpty(text).map { $0.clippedForShare(to: shareTextLimit) }
    )
}

/// One query value off the return-scheme URL. Normalises `+` to `%20` first: the page writes
/// spaces as `+`, and `URLComponents` does not fold them.
func sharingQueryValue(_ url: URL, _ name: String) -> String? {
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
    if let query = components.percentEncodedQuery, query.contains("+") {
        components.percentEncodedQuery = query.replacingOccurrences(of: "+", with: "%20")
    }
    return components.queryItems?.first { $0.name == name }?.value
}

/// Blank is "absent", not "override with nothing".
func nonEmpty(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

/// Re-validated independently of the page: this SDK fetches the URL, so a scheme downgrade
/// here is an SSRF vector.
private func sharingHTTPSImageURL(_ value: String) -> URL? {
    guard let url = URL(string: value), url.scheme == "https" else { return nil }
    return url
}

/// https-only and no private/link-local target: this SDK fetches a URL it did not choose.
func isFetchableShareImageURL(_ url: URL) -> Bool {
    guard url.scheme == "https", let host = url.host?.lowercased(), !host.isEmpty else { return false }
    if host == "localhost" || host.hasSuffix(".localhost") { return false }
    if host.hasSuffix(".local") || host.hasSuffix(".internal") { return false }
    if let address = IPv4Address(host) { return !address.isPrivateOrLinkLocal }
    // An IPv6 literal keeps its brackets in some `URL.host` paths and loses them in others.
    if host.contains(":") || host.hasPrefix("[") { return !isPrivateIPv6Literal(host) }
    return true
}

/// Prefix matching, not a parser: this only has to reject.
private func isPrivateIPv6Literal(_ host: String) -> Bool {
    let bare = host.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    if bare == "::1" || bare == "::" { return true }
    if bare.hasPrefix("fc") || bare.hasPrefix("fd") || bare.hasPrefix("fe8") || bare.hasPrefix("fe9")
        || bare.hasPrefix("fea") || bare.hasPrefix("feb")
    {
        return true
    }
    // `::ffff:a.b.c.d` — the embedded address is what actually gets routed, and `URL` may hand it
    // back hex-normalised (`::ffff:a00:1`), so both spellings have to be decoded.
    if bare.hasPrefix("::ffff:") {
        let mapped = String(bare.dropFirst("::ffff:".count))
        if let address = IPv4Address(mapped) { return address.isPrivateOrLinkLocal }
        let groups = mapped.split(separator: ":")
        if groups.count == 2, let high = UInt16(groups[0], radix: 16), let low = UInt16(groups[1], radix: 16) {
            return IPv4Address(
                octets: (UInt8(high >> 8), UInt8(high & 0xff), UInt8(low >> 8), UInt8(low & 0xff))
            ).isPrivateOrLinkLocal
        }
    }
    return false
}

/// Enough of RFC 1918 / RFC 3927 to reject a private target.
struct IPv4Address {
    let octets: (UInt8, UInt8, UInt8, UInt8)

    init(octets: (UInt8, UInt8, UInt8, UInt8)) {
        self.octets = octets
    }

    init?(_ host: String) {
        let parts = host.split(separator: ".")
        guard parts.count == 4 else { return nil }
        let values = parts.compactMap { UInt8($0) }
        guard values.count == 4 else { return nil }
        octets = (values[0], values[1], values[2], values[3])
    }

    var isPrivateOrLinkLocal: Bool {
        switch octets {
        // `0.0.0.0/8` routes to loopback on Darwin, so it bypasses the `127/8` rule.
        case (0, _, _, _): return true
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
    /// The copy used when no page reports its own: either there was never a page, or one
    /// resolved and never loaded. A page's `action=share` payload wins over it.
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

/// What the OS chooser says when there is no page to ask; local sources only, since the
/// resolved config may not be available.
struct Tier3ShareData: Equatable {
    let title: String
    let text: String
}

private let productNamePlaceholder = "{{productName}}"

/// Bundled defaults mirroring the wallet's `sharing.title`/`sharing.text`; kept in step by hand.
/// Exhaustive, so a third language fails the build rather than degrading at runtime.
private func tier3Defaults(for lang: FrakLanguage) -> Tier3ShareData {
    switch lang {
    case .en:
        Tier3ShareData(title: "{{productName}} invite link", text: "Discover this amazing product!")
    case .fr:
        Tier3ShareData(title: "Lien d'invitation {{productName}}", text: "Découvrez ce produit incroyable !")
    }
}

/// Per-call override, then the first product's title, then the bundled default.
func tier3ShareData(
    request: SharingRequest,
    productName: String?,
    lang: FrakLanguage?
) -> Tier3ShareData {
    let defaults = tier3Defaults(for: lang ?? .en)
    let fallbackTitle = nonEmpty(request.products.first?.title)
    let name = nonEmpty(productName)
    return Tier3ShareData(
        title: interpolateProductName(nonEmpty(request.shareTitle) ?? fallbackTitle ?? defaults.title, name),
        text: interpolateProductName(nonEmpty(request.shareText) ?? defaults.text, name)
    )
}

/// Drops the placeholder when there is no name. Takes the whitespace with it before punctuation,
/// so "Buy {{productName}}, now" cannot become "Buy , now", and collapses to one space elsewhere.
private func interpolateProductName(_ template: String, _ productName: String?) -> String {
    guard let productName else {
        let placeholder = NSRegularExpression.escapedPattern(for: productNamePlaceholder)
        return
            template
            .replacingOccurrences(
                of: "\\s*\(placeholder)\\s*(?=[,.!?;:])",
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: "\\s*\(placeholder)\\s*",
                with: " ",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return template.replacingOccurrences(of: productNamePlaceholder, with: productName)
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
