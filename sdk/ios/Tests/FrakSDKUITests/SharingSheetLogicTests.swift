import Foundation
import Testing

@testable import FrakSDKUI

/// The tier choice, which is where the load-failure bugs live.
///
/// These run on the macOS test host because `sharingDecision` and `SharingSession` sit outside
/// `SharingSheetModel`'s `#if canImport(UIKit)`. Note what this does *not* cover: the model
/// itself, and all of `SharingWebView` — `navigationFailed`, the navigation-response policy,
/// content-process termination and the frame guard have no executed coverage on any platform.
/// Their Android twins in `SharingWebViewClientTest.kt` are the only evidence for that logic.
@Suite("SharingDecision")
struct SharingSheetLogicTests {
    private static let pageURL = "https://wallet.frak.id/sharing?native=1"

    private func session(pageURL: String? = SharingSheetLogicTests.pageURL) -> SharingSession {
        SharingSession(
            walletOrigin: "https://wallet.frak.id",
            returnScheme: "frak-com.acme.app",
            link: "https://merchant.example/p?fCtx=abc",
            shareTitle: "Share and earn",
            pageURL: pageURL
        )
    }

    @Test("a session with a page shows it")
    func showsThePage() throws {
        let expected = try #require(URL(string: Self.pageURL))
        let decision = sharingDecision(
            session: session(),
            deadlineExpired: false,
            pageLoaded: false,
            fellBack: false,
            closed: false
        )
        #expect(decision == .showPage(expected))
    }

    @Test("a session without a page falls back immediately")
    func noPageFallsBack() {
        let built = session(pageURL: nil)
        let decision = sharingDecision(
            session: built,
            deadlineExpired: false,
            pageLoaded: false,
            fellBack: false,
            closed: false
        )
        // The link is local and always works; the page is the part that needs the network.
        #expect(decision == .nativeShare(built))
    }

    @Test("an expired deadline falls back even with a page to show")
    func expiredDeadlineFallsBack() {
        let built = session()
        let decision = sharingDecision(
            session: built,
            deadlineExpired: true,
            pageLoaded: false,
            fellBack: false,
            closed: false
        )
        #expect(decision == .nativeShare(built))
    }

    @Test("no session yet decides nothing, rather than falling back")
    func noSessionDecidesNothing() {
        let decision = sharingDecision(
            session: nil,
            deadlineExpired: true,
            pageLoaded: false,
            fellBack: false,
            closed: false
        )
        // `prepare` is still running and owns the decision; falling back here would race it
        // and queue a second `sharing` interaction.
        #expect(decision == .doNothing)
    }

    @Test("a loaded page is never overridden")
    func loadedPageWins() {
        let decision = sharingDecision(
            session: session(),
            deadlineExpired: true,
            pageLoaded: true,
            fellBack: false,
            closed: false
        )
        // A content-process crash after the page painted routes here; a chooser now would be a
        // share the user never asked for.
        #expect(decision == .doNothing)
    }

    @Test("falling back twice is not possible")
    func fallsBackOnce() {
        let decision = sharingDecision(
            session: session(pageURL: nil),
            deadlineExpired: true,
            pageLoaded: false,
            fellBack: true,
            closed: false
        )
        #expect(decision == .doNothing)
    }

    /// `pageURL` is present deliberately: with it nil, the guard order could be wrong and this
    /// would still pass.
    @Test("a closed sheet decides nothing, even with a page ready to show")
    func closedBeatsAPresentPage() {
        let decision = sharingDecision(
            session: session(),
            deadlineExpired: false,
            pageLoaded: false,
            fellBack: false,
            closed: true
        )
        #expect(decision == .doNothing)
    }

    @Test("the confirmed url appends the flag")
    func confirmedAppendsFlag() throws {
        let url = try #require(session().url(confirmed: true))
        // Without this the page sits there: under `native=1` it hides its own share controls.
        #expect(url.absoluteString.hasSuffix("&confirmed=1"))
    }

    @Test("a session with no page has no url either way")
    func noPageHasNoURL() {
        #expect(session(pageURL: nil).url(confirmed: false) == nil)
        #expect(session(pageURL: nil).url(confirmed: true) == nil)
    }
}
