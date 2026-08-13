import Foundation
import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("SharingDecision")
struct SharingSheetLogicTests {
    private static let pageURL = "https://wallet.frak.id/sharing?embed=native"

    private static let warmURL = "https://wallet.frak.id/sharing?embed=native&state=warm"
    private static let fragment = "#sid=session-1&state=live"

    private func session(
        pageURL: String? = SharingSheetLogicTests.pageURL,
        warmBaseURL: String? = nil,
        activationFragment: String? = nil
    ) -> SharingSession {
        SharingSession(
            walletOrigin: "https://wallet.frak.id",
            returnScheme: "frak-com.acme.app",
            link: "https://merchant.example/p?fCtx=abc",
            shareTitle: "Share and earn",
            pageURL: pageURL,
            warmBaseURL: warmBaseURL,
            activationFragment: activationFragment
        )
    }

    /// A session whose pool was warmed for this merchant, as `build` assembles one.
    private func warmedSession(pageURL: String? = SharingSheetLogicTests.pageURL) -> SharingSession {
        session(pageURL: pageURL, warmBaseURL: Self.warmURL, activationFragment: Self.fragment)
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
        #expect(decision == .showPage(.load(expected)))
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
        // Without this the page sits there: under `embed=native` it hides its own share controls.
        #expect(url.absoluteString.hasSuffix("&view=confirmation"))
    }

    @Test("a session with no page has no url either way")
    func noPageHasNoURL() {
        #expect(session(pageURL: nil).url(confirmed: false) == nil)
        #expect(session(pageURL: nil).url(confirmed: true) == nil)
    }

    // MARK: - Fragment activation

    @Test("a session on a matching warm page navigates by fragment only")
    func activatesOnTheWarmPage() throws {
        let expected = try #require(URL(string: Self.pageURL))
        let navigation = warmedSession().navigation(confirmed: false, currentBaseURL: Self.warmURL)
        #expect(navigation == .activate(fragment: Self.fragment, fullURL: expected))
    }

    @Test("a session whose warm page is not the one loaded does a full navigation")
    func fullLoadWhenTheWarmPageDiffers() throws {
        let expected = try #require(URL(string: Self.pageURL))
        // A pool warmed for another merchant; activating on top of it would show the wrong page.
        let other = warmedSession().navigation(
            confirmed: false,
            currentBaseURL: "https://wallet.frak.id/sharing?embed=native&state=warm&merchantId=other"
        )
        #expect(other == .load(expected))
        // And the ordinary case: nothing warmed at all.
        #expect(warmedSession().navigation(confirmed: false, currentBaseURL: nil) == .load(expected))
    }

    @Test("a session with no warm half of its own never activates")
    func neverActivatesWithoutBothHalves() throws {
        let expected = try #require(URL(string: Self.pageURL))
        // Preloading off: `build` leaves both halves nil.
        #expect(session().navigation(confirmed: false, currentBaseURL: Self.warmURL) == .load(expected))
    }

    @Test("the confirmation step stays same-document once activated")
    func confirmationActivatesToo() throws {
        let expected = try #require(URL(string: Self.pageURL + "&view=confirmation"))
        let navigation = warmedSession().navigation(confirmed: true, currentBaseURL: Self.warmURL)
        #expect(
            navigation
                == .activate(
                    fragment: Self.fragment + "&view=confirmation",
                    fullURL: expected
                )
        )
    }

    @Test("a warm session with no page still falls back rather than activating")
    func noPageBeatsActivation() {
        // No page to show, so the local link is all there is; `hasPage` is what the decision reads.
        let built = warmedSession(pageURL: nil)
        #expect(!built.hasPage)
        #expect(built.navigation(confirmed: false, currentBaseURL: Self.warmURL) == nil)
        let decision = sharingDecision(
            session: built,
            deadlineExpired: false,
            pageLoaded: false,
            fellBack: false,
            closed: false,
            currentBaseURL: Self.warmURL
        )
        #expect(decision == .nativeShare(built))
    }

    @Test("the decision carries the activation through")
    func decisionActivates() throws {
        let expected = try #require(URL(string: Self.pageURL))
        let decision = sharingDecision(
            session: warmedSession(),
            deadlineExpired: false,
            pageLoaded: false,
            fellBack: false,
            closed: false,
            currentBaseURL: Self.warmURL
        )
        #expect(decision == .showPage(.activate(fragment: Self.fragment, fullURL: expected)))
    }
}

@Suite("sharingChooserCompleted")
struct SharingChooserCompletedTests {
    @Test("an extension that picked a target counts, whatever it claims")
    func pickedTargetCounts() {
        // Message under-reports: `completed` false on a share that happened.
        #expect(
            sharingChooserCompleted(
                activityType: "com.apple.UIKit.activity.Message",
                completed: false,
                failed: false
            )
        )
        #expect(sharingChooserCompleted(activityType: "com.example.share", completed: true, failed: false))
    }

    @Test("a dismissed chooser is not a share")
    func dismissedIsNotAShare() {
        // Nothing picked: `activityType` is UIKit's own value and stays nil, so the two signals
        // agree here and this is the case the predicate must keep out.
        #expect(!sharingChooserCompleted(activityType: nil, completed: false, failed: false))
    }

    @Test("an error is never a share, whatever else it says")
    func errorIsNeverAShare() {
        #expect(!sharingChooserCompleted(activityType: "com.example.share", completed: true, failed: true))
        #expect(!sharingChooserCompleted(activityType: nil, completed: true, failed: true))
    }

    @Test("a claimed completion with no target still counts")
    func claimedCompletionCounts() {
        // `completed` is still a signal; refusing it here would trade one silent drop for another.
        #expect(sharingChooserCompleted(activityType: nil, completed: true, failed: false))
    }
}

@Suite("sharingExternalRoute")
struct SharingExternalRouteTests {
    private func route(_ string: String) throws -> SharingExternalRoute {
        sharingExternalRoute(try #require(URL(string: string)))
    }

    @Test("the wallet's listing is routed to the app handoff, not opened")
    func walletListingIsRouted() throws {
        // The link the web install page's download button actually carries.
        #expect(try route("https://apps.apple.com/app/frak-wallet/id6759159306") == .walletStoreListing)
        // Storefront-prefixed, which is what the App Store hands out on share.
        #expect(try route("https://apps.apple.com/us/app/frak-wallet/id6759159306") == .walletStoreListing)
        // Any id, not just the wallet's: the overlay is raised on a constant the URL cannot move.
        #expect(try route("https://apps.apple.com/app/id1") == .walletStoreListing)
        #expect(try route("HTTPS://APPS.APPLE.COM/app/id6759159306") == .walletStoreListing)
    }

    @Test("a merchant link is opened as-is")
    func merchantLinkIsOpened() throws {
        let url = try #require(URL(string: "https://shop.example.com/product"))
        #expect(sharingExternalRoute(url) == .openURL(url))
        // Apple's own domain, but not a listing: no `idNNN` component to find.
        let story = try #require(URL(string: "https://apps.apple.com/us/story/something"))
        #expect(sharingExternalRoute(story) == .openURL(story))
        // `id` with no digits behind it is a path segment, not an app id.
        let identity = try #require(URL(string: "https://apps.apple.com/app/identity"))
        #expect(sharingExternalRoute(identity) == .openURL(identity))
        // A look-alike host must not reach the overlay.
        #expect(try route("https://apps.apple.com.evil.test/app/id6759159306") != .walletStoreListing)
    }

    @Test("anything but http(s) is dropped")
    func customSchemesAreDropped() throws {
        // An app-to-app launch the merchant never sanctioned, whatever the page asked for.
        #expect(try route("frakwallet://install?m=m&a=a") == .ignore)
        #expect(try route("itms-apps://apps.apple.com/app/id6759159306") == .ignore)
        #expect(try route("javascript:alert(1)") == .ignore)
    }
}

@Suite("SharingPageProductsJSON")
struct SharingPageProductsJSONTests {
    private func product(details: ProductDetails? = nil) -> SharingProduct {
        SharingProduct(
            title: "Kettle",
            link: "https://acme.example/kettle",
            imageURL: "https://acme.example/kettle.png",
            utmContent: "kettle",
            details: details
        )
    }

    @Test("scope fields reach the wire alongside the display fields")
    func flattensScopeFields() throws {
        let json = try #require(
            sharingPageProductsJSON([
                product(details: ProductDetails(productId: "p1", sku: "SHOE-42", name: "Kettle"))
            ])
        )

        #expect(json.contains("\"sku\":\"SHOE-42\""))
        #expect(json.contains("\"productId\":\"p1\""))
        #expect(json.contains("\"name\":\"Kettle\""))
        #expect(json.contains("\"title\":\"Kettle\""))
        #expect(json.contains("\"link\":\"https:\\/\\/acme.example\\/kettle\""))
        #expect(json.contains("\"utmContent\":\"kettle\""))
    }

    /// `JSONSerialization` prints a bare `Double` at binary precision: `79.9` as `79.900000000000006`.
    @Test("prices serialize the way JSON.stringify writes them, not at binary precision")
    func numbersMatchJSONStringify() throws {
        let json = try #require(
            sharingPageProductsJSON([
                product(details: ProductDetails(quantity: 2, unitPrice: 79.9, totalPrice: 159.8))
            ])
        )

        #expect(json.contains("\"unitPrice\":79.9"))
        #expect(json.contains("\"totalPrice\":159.8"))
        // Integral values lose the `.0` `JSON.stringify` never emits.
        #expect(json.contains("\"quantity\":2"))
        #expect(!json.contains("2.0"))
    }

    @Test("a product with no details carries no scope keys at all")
    func omitsAbsentScopeFields() throws {
        let json = try #require(sharingPageProductsJSON([product()]))

        for key in ["productId", "sku", "name", "quantity", "unitPrice", "totalPrice"] {
            #expect(!json.contains("\"\(key)\""))
        }
        #expect(json.contains("\"title\":\"Kettle\""))
    }

    @Test("no products yields nil, so the page skips the card section")
    func emptyIsNil() {
        #expect(sharingPageProductsJSON([]) == nil)
    }
}

extension SharingPageProductsJSONTests {
    /// `JSONSerialization` rejects a non-finite number, so an unguarded NaN takes the array down.
    @Test("a non-finite price is dropped, not allowed to fail the whole array")
    func nonFiniteNumbersAreDropped() throws {
        let json = try #require(
            sharingPageProductsJSON([
                product(details: ProductDetails(quantity: .nan, unitPrice: .infinity, totalPrice: 12.5))
            ])
        )

        #expect(!json.contains("quantity"))
        #expect(!json.contains("unitPrice"))
        #expect(json.contains("\"totalPrice\":12.5"))
        #expect(json.contains("\"title\":\"Kettle\""))
    }

    /// `JSON.stringify(-0)` writes `0`, and Kotlin's integral path agrees.
    @Test("negative zero serializes the way JSON.stringify writes it")
    func negativeZeroMatchesJSONStringify() throws {
        let json = try #require(sharingPageProductsJSON([product(details: ProductDetails(quantity: -0.0))]))

        #expect(json.contains("\"quantity\":0"))
        #expect(!json.contains("-0"))
    }
}

@Suite("clampedSharingHeightFraction")
struct ClampedSharingHeightFractionTests {
    @Test("a value already inside the range is left untouched")
    func withinRangePassesThrough() {
        #expect(clampedSharingHeightFraction(0.7) == 0.7)
        #expect(clampedSharingHeightFraction(0.3) == 0.3)
        #expect(clampedSharingHeightFraction(1.0) == 1.0)
    }

    @Test("a value below the floor is raised to it")
    func belowFloorIsRaised() {
        #expect(clampedSharingHeightFraction(0.0) == 0.3)
        #expect(clampedSharingHeightFraction(-1.0) == 0.3)
    }

    @Test("a value above the ceiling is lowered to it")
    func aboveCeilingIsLowered() {
        #expect(clampedSharingHeightFraction(2.0) == 1.0)
    }

    @Test("a non-finite value falls back to the default rather than propagating")
    func nonFiniteFallsBackToDefault() {
        #expect(clampedSharingHeightFraction(.nan) == FrakSharingDefaults.heightFraction)
        #expect(clampedSharingHeightFraction(.infinity) == FrakSharingDefaults.heightFraction)
        #expect(clampedSharingHeightFraction(-.infinity) == FrakSharingDefaults.heightFraction)
    }

    @Test("the public default itself is inside the clamp's own range")
    func defaultIsWithinRange() {
        #expect(clampedSharingHeightFraction(FrakSharingDefaults.heightFraction) == FrakSharingDefaults.heightFraction)
    }
}

@Suite("sharing build retry ladder")
struct SharingBuildRetryTests {
    // Every kind below is one `SharingSheetModel.build` can actually raise.
    @Test("a cold start's identity or link failure is retried")
    func coldStartFailureIsRetried() {
        // The enclave refused to mint a key — never cached, so the next attempt can succeed.
        #expect(sharingBuildIsWorthRetrying(.internalFailure(message: "the device refused key material")))
        // Nothing to link to yet, because the resolved config's homepage link has not landed.
        #expect(sharingBuildIsWorthRetrying(.merchantResolutionFailed(reason: "nothing to link to")))
        #expect(sharingBuildIsWorthRetrying(.network(underlying: URLError(.timedOut))))
        #expect(sharingBuildIsWorthRetrying(.backingOff(retryAfterSeconds: 1)))
        #expect(sharingBuildIsWorthRetrying(.server(status: 503, code: nil, retryAfterSeconds: nil)))
        #expect(sharingBuildIsWorthRetrying(.decoding(message: "bad body")))
    }

    @Test("a decision the merchant already made is not retried")
    func settledFailureIsNotRetried() {
        // Both reach the ladder for real: `buildLink` raises `trackingDisabled` on a withdrawn
        // consent, and `Frak.client` raises `notInitialized`. Retrying either just makes the user
        // wait out the whole ladder for an answer that cannot change.
        #expect(!sharingBuildIsWorthRetrying(.notInitialized))
        #expect(!sharingBuildIsWorthRetrying(.trackingDisabled))
        #expect(!sharingBuildIsWorthRetrying(.alreadyPresenting))
    }

    @Test("the ladder fits inside the tap-to-content deadline")
    func ladderFitsInsideTheDeadline() {
        // Otherwise the last attempt lands after the deadline has already raised the OS chooser,
        // and the sheet holds a skeleton over a share that has moved on without it.
        #expect(sharingBuildRetryDelays.reduce(0, +) < 5)
        #expect(sharingBuildRetryDelays.allSatisfy { $0 > 0 })
    }
}
