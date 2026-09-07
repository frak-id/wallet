import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("tier3ShareData")
struct Tier3ShareDataTests {
    @Test("a per-call override wins outright, over both the product and the bundled default")
    func perCallOverrideWins() {
        let request = SharingRequest(
            products: [SharingProduct(title: "Kettle", link: "https://acme.example/k")],
            shareTitle: "Custom title",
            shareText: "Custom text"
        )
        let data = tier3ShareData(request: request, productName: "Acme", lang: .en)
        #expect(data.title == "Custom title")
        #expect(data.text == "Custom text")
    }

    @Test("the first product's title stands in for the title when there is no override")
    func firstProductTitleIsTheFallback() {
        let request = SharingRequest(
            products: [
                SharingProduct(title: "Kettle", link: "https://acme.example/k"),
                SharingProduct(title: "Toaster", link: "https://acme.example/t"),
            ]
        )
        let data = tier3ShareData(request: request, productName: "Acme", lang: .en)
        #expect(data.title == "Kettle")
    }

    @Test("the product title does not stand in for the body text — only the bundled default does")
    func productTitleDoesNotFillTheBodyText() {
        let request = SharingRequest(products: [SharingProduct(title: "Kettle", link: "https://acme.example/k")])
        let data = tier3ShareData(request: request, productName: nil, lang: .en)
        #expect(data.text == "Discover this amazing product!")
    }

    @Test("with nothing to override or borrow, the bundled default wins")
    func bundledDefaultIsTheFloor() {
        let data = tier3ShareData(request: SharingRequest(), productName: "Acme", lang: .en)
        #expect(data.title == "Acme invite link")
        #expect(data.text == "Discover this amazing product!")
    }

    @Test("french constants are used for a merchant configured for fr")
    func frenchConstantsForFrenchLang() {
        let data = tier3ShareData(request: SharingRequest(), productName: "Acme", lang: .fr)
        #expect(data.title == "Lien d'invitation Acme")
        #expect(data.text == "Découvrez ce produit incroyable !")
    }

    @Test("a nil lang falls back to english")
    func nilLangFallsBackToEnglish() {
        let data = tier3ShareData(request: SharingRequest(), productName: "Acme", lang: nil)
        #expect(data.title == "Acme invite link")
    }

    @Test("a nil product name drops the placeholder and its surrounding whitespace")
    func nilProductNameDropsThePlaceholderCleanly() {
        let en = tier3ShareData(request: SharingRequest(), productName: nil, lang: .en)
        #expect(en.title == "invite link")
        #expect(!en.title.hasPrefix(" "))

        let fr = tier3ShareData(request: SharingRequest(), productName: nil, lang: .fr)
        #expect(fr.title == "Lien d'invitation")
        #expect(!fr.title.hasSuffix(" "))
    }

    @Test("a dropped placeholder does not leave a doubled space before punctuation")
    func droppedPlaceholderDoesNotStrandPunctuation() {
        let request = SharingRequest(shareTitle: "Buy {{productName}}, now")
        #expect(tier3ShareData(request: request, productName: nil, lang: .en).title == "Buy, now")
    }

    @Test("the French default keeps its own space before the exclamation mark")
    func frenchDefaultKeepsItsSpacedPunctuation() {
        let fr = tier3ShareData(request: SharingRequest(), productName: nil, lang: .fr)
        #expect(fr.text == "Découvrez ce produit incroyable !")
    }

    @Test("a per-call override with its own placeholder still interpolates")
    func overridePlaceholderStillInterpolates() {
        let request = SharingRequest(shareTitle: "Win big with {{productName}}")
        let data = tier3ShareData(request: request, productName: "Acme", lang: .en)
        #expect(data.title == "Win big with Acme")
    }

    @Test("a blank override does not beat the value under it")
    func blankOverrideLosesToTheTierBelow() {
        let request = SharingRequest(
            products: [SharingProduct(title: "Kettle", link: "https://acme.example/k")],
            shareTitle: "   ",
            shareText: ""
        )
        let data = tier3ShareData(request: request, productName: "Acme", lang: .en)
        #expect(data.title == "Kettle")
        #expect(data.text == "Discover this amazing product!")
    }

    @Test("a blank product name is treated as absent, leaving no stray whitespace")
    func blankProductNameDropsThePlaceholder() {
        let data = tier3ShareData(request: SharingRequest(), productName: "", lang: .en)
        #expect(data.title == "invite link")
    }

    @Test("a blank product title does not beat the bundled default")
    func blankProductTitleLosesToTheDefault() {
        let request = SharingRequest(products: [SharingProduct(title: "  ", link: "https://acme.example/k")])
        let data = tier3ShareData(request: request, productName: "Acme", lang: .en)
        #expect(data.title == "Acme invite link")
    }

    @Test("no reward-bearing placeholder exists in the bundled constants")
    func noRewardPlaceholder() {
        let data = tier3ShareData(request: SharingRequest(), productName: "Acme", lang: .en)
        #expect(!data.title.contains("{{"))
        #expect(!data.text.contains("{{"))
    }
}
