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

    /// `JSONSerialization` prints a bare `Double` at binary precision: `79.9` would go out as
    /// `79.900000000000006`.
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
