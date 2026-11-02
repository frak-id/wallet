import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("sharingPreviewImageURL")
struct SharingPreviewImageURLTests {
    private static func product(_ title: String, _ image: String?) -> SharingProduct {
        SharingProduct(title: title, link: "https://acme.example/p", imageURL: image)
    }

    @Test("the caller's share image wins over every product image")
    func overrideWins() {
        let request = SharingRequest(
            products: [Self.product("Shoe", "https://cdn.example/shoe.jpg")],
            shareImageURL: "https://cdn.example/share.jpg"
        )
        #expect(sharingPreviewImageURL(request)?.absoluteString == "https://cdn.example/share.jpg")
    }

    @Test("without an override, the first titled product's image, as the page selects it")
    func firstTitledProduct() {
        let request = SharingRequest(products: [
            Self.product("  ", "https://cdn.example/untitled.jpg"),
            Self.product("Shoe", "https://cdn.example/shoe.jpg"),
            Self.product("Hat", "https://cdn.example/hat.jpg"),
        ])
        #expect(sharingPreviewImageURL(request)?.absoluteString == "https://cdn.example/shoe.jpg")
    }

    @Test("a selected product with no image does not borrow the next one's")
    func noBorrowing() {
        // The page falls back to the logo here, which the warm-up already fetches.
        let request = SharingRequest(products: [
            Self.product("Shoe", nil),
            Self.product("Hat", "https://cdn.example/hat.jpg"),
        ])
        #expect(sharingPreviewImageURL(request) == nil)
    }

    @Test("an empty override falls through to the product image")
    func blankOverrideFallsThrough() {
        let request = SharingRequest(
            products: [Self.product("Shoe", "https://cdn.example/shoe.jpg")],
            shareImageURL: ""
        )
        #expect(sharingPreviewImageURL(request)?.absoluteString == "https://cdn.example/shoe.jpg")
    }
}
