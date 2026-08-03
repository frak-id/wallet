import Foundation
import FrakSDK
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

/// What reaches the hosted page's `products=` parameter.
///
/// The wallet route forwards this same array straight into reward selection
/// (`rewardProductsForSelection` → `selectBestReward`), so a scope field missing here is a
/// product-gated campaign the page silently misranks. Twinned with
/// `SharingSheetStateTest`'s `product scope fields reach the page url` on Android.
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
        // The display half must survive the flattening.
        #expect(json.contains("\"title\":\"Kettle\""))
        #expect(json.contains("\"link\":\"https:\\/\\/acme.example\\/kettle\""))
        #expect(json.contains("\"utmContent\":\"kettle\""))
    }

    /// The bug this pins: `JSONSerialization` prints a bare `Double` at full binary precision,
    /// so `79.9` would go out as `79.900000000000006` and lose an `eq` scope comparison that
    /// Android, printing `79.9`, wins. Prices are exactly the field campaigns gate on.
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
    /// `JSONSerialization` rejects a non-finite number outright, so an unguarded NaN would take
    /// the whole product array down — every card lost over one unusable price. Android's
    /// `JSONObject.put` throws on the same input, inside the sheet's `launch`.
    @Test("a non-finite price is dropped, not allowed to fail the whole array")
    func nonFiniteNumbersAreDropped() throws {
        let json = try #require(
            sharingPageProductsJSON([
                product(details: ProductDetails(quantity: .nan, unitPrice: .infinity, totalPrice: 12.5))
            ])
        )

        #expect(!json.contains("quantity"))
        #expect(!json.contains("unitPrice"))
        // The usable field on the same product survives.
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

/// The defensive clamp on a merchant-supplied `heightFraction`, run on the macOS test host
/// since `clampedSharingHeightFraction` sits outside `SharingSheetModel`'s `#if
/// canImport(UIKit)` for exactly that reason.
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
