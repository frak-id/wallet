import Testing

@testable import FrakSDKUI

@Suite("FrakSharingConfiguration")
struct FrakSharingConfigurationTests {
    @Test("an unconfigured sheet gets the store product page, not the overlay")
    func defaultsToTheStoreProductPage() {
        #expect(FrakSharingConfiguration().install == .storeProductPage(.init()))
    }

    @Test("an unconfigured sheet gets the published default height")
    func defaultsToThePublishedHeight() {
        #expect(FrakSharingConfiguration().heightFraction == FrakSharingDefaults.heightFraction)
    }

    @Test("the shorthands carry the same options as an empty explicit case")
    func shorthandsMatchEmptyOptions() {
        #expect(FrakInstallPresentation.storeProductPage == .storeProductPage(.init()))
        #expect(FrakInstallPresentation.overlay == .overlay(.init()))
    }

    @Test("an overlay defaults to the bottom position and stays user-dismissible")
    func overlayDefaults() {
        let overlay = FrakInstallPresentation.Overlay()
        #expect(overlay.position == .bottom)
        #expect(overlay.userDismissible)
    }

    @Test("no attribution token is invented for either surface")
    func noTokensByDefault() {
        let page = FrakInstallPresentation.StoreProductPage()
        #expect(page.campaignToken == nil)
        #expect(page.providerToken == nil)
        #expect(page.customProductPageId == nil)

        let overlay = FrakInstallPresentation.Overlay()
        #expect(overlay.campaignToken == nil)
        #expect(overlay.providerToken == nil)
        #expect(overlay.customProductPageId == nil)
    }

    @Test("the two surfaces are never equal, whatever their options")
    func surfacesAreDistinct() {
        #expect(FrakInstallPresentation.storeProductPage != .overlay)
        #expect(
            FrakInstallPresentation.storeProductPage(.init(campaignToken: "a"))
                != .storeProductPage(.init(campaignToken: "b"))
        )
    }
}
