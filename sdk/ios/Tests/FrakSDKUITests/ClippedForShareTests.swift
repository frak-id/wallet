import Foundation
import Testing

@testable import FrakSDKUI

/// Mirrors `truncateForShare` in `packages/wallet-shared`: same budget, same unit, same ellipsis.
@Suite("String.clippedForShare")
struct ClippedForShareTests {
    @Test("a value inside the budget is untouched")
    func insideBudgetIsUntouched() {
        #expect("Discover this".clippedForShare(to: 280) == "Discover this")
    }

    @Test("a value exactly at the budget is untouched")
    func exactlyAtBudgetIsUntouched() {
        let exact = String(repeating: "a", count: 120)
        #expect(exact.clippedForShare(to: 120) == exact)
    }

    @Test("one unit over the budget clips, ellipsis included in the budget")
    func oneOverBudgetClips() {
        let result = String(repeating: "a", count: 121).clippedForShare(to: 120)
        #expect(result.utf16.count <= 120)
        #expect(result.hasSuffix("…"))
    }

    @Test("the budget counts UTF-16 units, so a ZWJ sequence cannot slip past it")
    func budgetCountsUTF16Units() {
        // A family-of-four is one grapheme but eleven UTF-16 units.
        let family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}"
        let value = String(repeating: family, count: 30)
        #expect(value.utf16.count > 120)
        let result = value.clippedForShare(to: 120)
        #expect(result.utf16.count <= 120)
        #expect(result.hasSuffix("…"))
    }

    @Test("an emoji at the cut point is never split into a lone surrogate")
    func emojiIsNeverSplit() {
        let result = String(repeating: "😀", count: 50).clippedForShare(to: 21)
        #expect(result.utf16.count <= 21)
        #expect(!result.unicodeScalars.contains { $0.properties.isDefaultIgnorableCodePoint })
        // Everything before the ellipsis survived as whole emoji.
        #expect(result.dropLast().allSatisfy { $0 == "😀" })
    }

    @Test("a combining mark stays with its base character")
    func combiningMarkStaysWithItsBase() {
        let result = String(repeating: "e\u{0301}", count: 40).clippedForShare(to: 21)
        #expect(result.hasSuffix("…"))
        #expect(!result.dropLast().hasPrefix("\u{0301}"))
    }

    @Test("whitespace the cut leaves behind is trimmed before the ellipsis")
    func trailingWhitespaceIsTrimmed() {
        let value = String(repeating: "a", count: 15) + "     bbbb"
        #expect(value.clippedForShare(to: 20) == String(repeating: "a", count: 15) + "…")
    }

    @Test("under the ellipsis' own width the result is whole graphemes and no marker")
    func tinyBudgetDropsTheMarker() {
        #expect("abc".clippedForShare(to: 1) == "a")
        // A single emoji is two UTF-16 units, so none of it fits.
        #expect("😀😀".clippedForShare(to: 1) == "")
    }

    @Test("matches the page-side reference at the ellipsis boundary")
    func matchesThePageReference() {
        #expect("abc".clippedForShare(to: 2) == "a…")
        #expect("😀😀".clippedForShare(to: 2) == "…")
        #expect("😀😀😀".clippedForShare(to: 5) == "😀😀…")
    }

    @Test("never exceeds the budget for any max on a multi-unit string")
    func neverExceedsTheBudget() {
        let value = String(repeating: "😀", count: 40)
        for max in 1...40 {
            #expect(value.clippedForShare(to: max).utf16.count <= max, "max \(max)")
        }
    }
}
