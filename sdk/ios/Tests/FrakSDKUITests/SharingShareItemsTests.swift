import Foundation
import Testing

@testable import FrakSDKUI

@Suite("sharingShareItems")
struct SharingShareItemsTests {
    @Test("the link always travels, with title and text alongside it")
    func carriesAllThree() {
        let items = sharingShareItems(
            link: "https://acme.example/r?fCtx=abc",
            title: "Kettle deal",
            text: "Grab it before it's gone"
        )
        #expect(items.link == "https://acme.example/r?fCtx=abc")
        #expect(items.title == "Kettle deal")
        #expect(items.text == "Grab it before it's gone")
    }

    @Test("an absent text means no second activity item, so the link is never glued to a body")
    func absentTextStaysAbsent() {
        let items = sharingShareItems(link: "https://acme.example/r", title: "Kettle", text: nil)
        #expect(items.text == nil)
    }

    @Test("a blank title or text is absent, never an empty subject")
    func blankIsAbsent() {
        let items = sharingShareItems(link: "https://acme.example/r", title: "   ", text: "\n\t ")
        #expect(items.title == nil)
        #expect(items.text == nil)
    }

    @Test("an over-budget title and text are clipped to the wire budget")
    func overBudgetIsClipped() {
        let items = sharingShareItems(
            link: "https://acme.example/r",
            title: String(repeating: "t", count: 400),
            text: String(repeating: "b", count: 400)
        )
        #expect((items.title?.utf16.count ?? 0) <= shareTitleLimit)
        #expect((items.text?.utf16.count ?? 0) <= shareTextLimit)
        #expect(items.title?.hasSuffix("…") == true)
        #expect(items.text?.hasSuffix("…") == true)
    }

    @Test("the link is never clipped — a truncated URL is a broken one")
    func linkIsNeverClipped() {
        let long = "https://acme.example/r?fCtx=" + String(repeating: "a", count: 600)
        #expect(sharingShareItems(link: long, title: nil, text: nil).link == long)
    }
}
