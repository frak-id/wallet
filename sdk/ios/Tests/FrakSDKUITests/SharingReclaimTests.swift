@_spi(FrakInternal) import FrakSDK
import Testing

@testable import FrakSDKUI

/// What a closing sheet's view is reset to, and what the reset fragment is allowed to say.
///
/// Both halves are quiet when wrong. Reset the wrong way and the pool either strands the previous
/// share's params on a page the next sheet activates, or silently pays a full page load between
/// every sheet — which is what it used to do, and the reason warming never showed up as a win.
@Suite("SharingReclaim")
struct SharingReclaimTests {
    private static let warmURL =
        "https://wallet.frak.id/sharing?embed=native&state=warm&merchantId=m1&clientId=c1&sid=warm"
    private static let sessionURL =
        "https://wallet.frak.id/sharing?embed=native&merchantId=m1&clientId=c1&sid=session-1"

    @Test("a view that was never warmed is parked, not loaded")
    func neverWarmedParks() {
        #expect(sharingReclaim(warmURL: nil, loadedBaseURL: nil, documentReady: false) == .park)
        // Still parked even though a session loaded a page on it: there is no warm URL to go back
        // to, so the pool has nothing to reload and `SharingPresenter.warm` will supply one later.
        #expect(
            sharingReclaim(warmURL: nil, loadedBaseURL: Self.sessionURL, documentReady: true) == .park
        )
    }

    @Test("a session that activated on the warm document resets in place")
    func activatedSessionResetsInPlace() {
        // The shape `SharingWebView.navigate(.activate:)` leaves behind: it deliberately does not
        // go through `load(_:)`, so both of these still describe the warm document.
        #expect(
            sharingReclaim(
                warmURL: Self.warmURL,
                loadedBaseURL: Self.warmURL,
                documentReady: true
            ) == .resetInPlace
        )
    }

    @Test("a session that loaded its own page is reloaded, not reset")
    func fullLoadReloads() {
        // Tap beat the warm-up, so the session did a full load and the document is no longer the
        // warm one. Hanging a warm fragment off it would reset the params of the wrong page.
        #expect(
            sharingReclaim(
                warmURL: Self.warmURL,
                loadedBaseURL: Self.sessionURL,
                documentReady: true
            ) == .reload(Self.warmURL)
        )
    }

    @Test("an unfinished warm document is reloaded rather than reset")
    func unfinishedDocumentReloads() {
        // Same gate `SharingPresentation` activates on: a half-loaded document has nothing to hang
        // a fragment off, and a fragment change starts no request to finish it.
        #expect(
            sharingReclaim(
                warmURL: Self.warmURL,
                loadedBaseURL: Self.warmURL,
                documentReady: false
            ) == .reload(Self.warmURL)
        )
    }

    @Test("the install page is reloaded, not reset")
    func installPageReloads() {
        #expect(
            sharingReclaim(
                warmURL: Self.warmURL,
                loadedBaseURL: "https://wallet.frak.id/install?merchantId=m1",
                documentReady: true
            ) == .reload(Self.warmURL)
        )
    }
}

/// The contract between the reset fragment and the hosted page's param table.
@Suite("SharingPageURL.warmFragment")
struct SharingWarmFragmentTests {
    @Test("states `warm` outright rather than relying on the page's default")
    func statesWarmOutright() {
        // `SHARING_PARAMS.state.fragmentDefault` is `live`, so a fragment that omits `state` turns
        // the page live — it would reset the params and still report the sheet as viewed.
        #expect(SharingPageURL.warmFragment.contains("state=warm"))
    }

    @Test("carries the warm session id, which no sheet can be attributed to")
    func carriesTheWarmSessionId() {
        #expect(SharingPageURL.warmFragment.contains("sid=" + SharingPageURL.warmSessionId))
    }

    @Test("omits every key whose warm value has to stand again")
    func omitsTheSessionKeys() {
        // The page spreads a fragment over the params it was loaded with, and those are frozen at
        // document load, so an omitted key falls back to the warm URL's own value. Naming one here
        // would pin the previous share's value instead — which is the ghost this reset exists to
        // clear. `logoUrl` is included: a request may override it, and only the fragment carries
        // that override.
        for key in ["link=", "products=", "seedReward=", "view=", "logoUrl="] {
            #expect(!SharingPageURL.warmFragment.contains(key), "warmFragment must not pin \(key)")
        }
    }

    @Test("is a fragment, so hanging it off a committed URL stays same-document")
    func isAFragment() {
        #expect(SharingPageURL.warmFragment.hasPrefix("#"))
        // One `#` only: a second would be read as part of the fragment's own value.
        #expect(SharingPageURL.warmFragment.filter { $0 == "#" }.count == 1)
    }
}
