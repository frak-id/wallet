import Foundation

/// The share, resolved once before anything can be shown.
///
/// `link` is built by `FrakClient.buildSharingLink`, which is entirely local and works on
/// a cold cache with no network. `pageURL` is the part that needs the network and can
/// legitimately be absent while `link` is not — a session with no page is not a broken
/// session, it is what the native-share fallback fires from.
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

/// The tier choice, as one predicate.
///
/// Lives outside `#if canImport(UIKit)` so it is reachable from the macOS test host, which
/// cannot compile the model that calls it.
///
/// `deadlineExpired` means "the 1.5s tap-to-content budget is gone", true both when the deadline
/// task fires and when `prepare` returns to find it already fired. A nil `session` is not a
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
