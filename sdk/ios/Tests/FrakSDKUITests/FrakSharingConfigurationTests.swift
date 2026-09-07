import Testing

@testable import FrakSDKUI

@Suite("FrakSharingConfiguration")
struct FrakSharingConfigurationTests {
    @Test("an unconfigured sheet gets the store product page, not the overlay")
    func defaultsToTheStoreProductPage() {
        #expect(FrakSharingConfiguration().install == .storeProductPage)
    }

    @Test("an unconfigured sheet gets the published default height")
    func defaultsToThePublishedHeight() {
        #expect(FrakSharingConfiguration().heightFraction == FrakSharingDefaults.heightFraction)
    }

    @Test("the overlay shorthand carries the same options as an empty explicit case")
    func shorthandMatchesEmptyOptions() {
        #expect(FrakInstallPresentation.overlay == .overlay(.init()))
    }

    @Test("an overlay defaults to the bottom position")
    func overlayDefaults() {
        #expect(FrakInstallPresentation.Overlay().position == .bottom)
    }

    @Test("the two surfaces are never equal, whatever the overlay's options")
    func surfacesAreDistinct() {
        #expect(FrakInstallPresentation.storeProductPage != .overlay)
        #expect(
            FrakInstallPresentation.overlay(.init(position: .bottom))
                != .overlay(.init(position: .bottomRaised))
        )
    }
}
