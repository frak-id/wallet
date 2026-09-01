import Foundation
import Testing

@testable import FrakSDKUI

/// `URL(string:)` is optional and force-unwrapping is banned, so every literal goes through here.
private func url(_ value: String) throws -> URL {
    try #require(URL(string: value))
}

@Suite("SharingPageAction.from — action dispatch")
struct SharingPageActionDispatchTests {
    @Test("known actions map to their case")
    func knownActionsMap() {
        #expect(SharingPageAction.from(action: "install", value: nil, exp: nil) == .install)
        #expect(SharingPageAction.from(action: "dismiss", value: nil, exp: nil) == .dismiss)
        #expect(SharingPageAction.from(action: "shareAgain", value: nil, exp: nil) == .shareAgain)
        #expect(SharingPageAction.from(action: "copy", value: nil, exp: nil) == .copy)
        #expect(SharingPageAction.from(action: "error", value: nil, exp: nil) == .error)
        #expect(SharingPageAction.from(action: "ready", value: nil, exp: nil) == .ready)
    }

    @Test("an unknown action is nil, not a failure")
    func unknownActionIsNil() {
        #expect(SharingPageAction.from(action: "not-a-real-action", value: nil, exp: nil) == nil)
    }

    @Test("a code action needs a non-empty value")
    func codeNeedsValue() {
        #expect(SharingPageAction.from(action: "code", value: nil, exp: nil) == nil)
        #expect(SharingPageAction.from(action: "code", value: "", exp: nil) == nil)
        #expect(
            SharingPageAction.from(action: "code", value: "AB12CD", exp: nil)
                == .code(value: "AB12CD", expiresAt: nil)
        )
    }

    @Test("an unparseable expiry is dropped rather than failing the whole action")
    func unparseableExpiryIsDropped() {
        #expect(
            SharingPageAction.from(action: "code", value: "AB12CD", exp: "not-a-number")
                == .code(value: "AB12CD", expiresAt: nil)
        )
        #expect(
            SharingPageAction.from(action: "code", value: "AB12CD", exp: "NaN")
                == .code(value: "AB12CD", expiresAt: nil)
        )
    }
}

@Suite("SharingPageAction.from — share payload")
struct SharingPageActionSharePayloadTests {
    @Test("carries title, text and https image through")
    func carriesFieldsThrough() throws {
        let action = SharingPageAction.from(
            action: "share",
            value: nil,
            exp: nil,
            shareTitle: "Kettle deal",
            shareText: "Grab it before it's gone",
            shareImage: "https://cdn.example.com/p.png"
        )
        #expect(
            action
                == .share(
                    SharingSharePayload(
                        title: "Kettle deal",
                        text: "Grab it before it's gone",
                        imageURL: try url("https://cdn.example.com/p.png")
                    )
                )
        )
    }

    @Test("an empty string decodes to nil, not an empty override")
    func emptyStringDecodesToNil() {
        let action = SharingPageAction.from(
            action: "share",
            value: nil,
            exp: nil,
            shareTitle: "",
            shareText: "",
            shareImage: ""
        )
        #expect(action == .share(SharingSharePayload(title: nil, text: nil, imageURL: nil)))
    }

    @Test("a whitespace-only string decodes to nil")
    func blankStringDecodesToNil() {
        let action = SharingPageAction.from(
            action: "share",
            value: nil,
            exp: nil,
            shareTitle: "   ",
            shareText: "\n\t "
        )
        #expect(action == .share(SharingSharePayload(title: nil, text: nil, imageURL: nil)))
    }

    @Test("every field absent still produces a share action, all nil")
    func allAbsentStillShares() {
        #expect(
            SharingPageAction.from(action: "share", value: nil, exp: nil)
                == .share(SharingSharePayload(title: nil, text: nil, imageURL: nil))
        )
    }

    @Test("a non-https image url is rejected — re-validated independently of the page's own check")
    func nonHTTPSImageIsRejected() {
        let action = SharingPageAction.from(
            action: "share",
            value: nil,
            exp: nil,
            shareImage: "http://cdn.example.com/p.png"
        )
        guard case .share(let payload) = action else {
            Issue.record("expected a share action")
            return
        }
        #expect(payload.imageURL == nil)
    }

    @Test("an unparseable image url is rejected rather than crashing the parse")
    func unparseableImageIsRejected() {
        let action = SharingPageAction.from(action: "share", value: nil, exp: nil, shareImage: "::not a url::")
        guard case .share(let payload) = action else {
            Issue.record("expected a share action")
            return
        }
        #expect(payload.imageURL == nil)
    }
}

@Suite("SharingPageAction.Kind")
struct SharingPageActionKindTests {
    @Test("two share actions with different payloads still collide as the same kind")
    func differentPayloadsShareAKind() {
        let first = SharingPageAction.share(
            SharingSharePayload(title: "a", text: nil, imageURL: nil)
        )
        let second = SharingPageAction.share(
            SharingSharePayload(title: "b", text: nil, imageURL: nil)
        )
        #expect(first != second)
        #expect(first.kind == second.kind)
        #expect(first.kind == .share)
    }

    @Test("every case maps to a distinct kind")
    func everyCaseHasItsOwnKind() {
        let kinds: [SharingPageAction.Kind] = [
            SharingPageAction.install.kind,
            SharingPageAction.dismiss.kind,
            SharingPageAction.shareAgain.kind,
            SharingPageAction.share(SharingSharePayload(title: nil, text: nil, imageURL: nil)).kind,
            SharingPageAction.copy.kind,
            SharingPageAction.error.kind,
            SharingPageAction.ready.kind,
            SharingPageAction.code(value: "x", expiresAt: nil).kind,
        ]
        #expect(Set(kinds).count == kinds.count)
    }
}

@Suite("sharingQueryValue")
struct SharingQueryValueTests {
    @Test("a URLSearchParams space arrives as a space, not a plus")
    func plusDecodesToSpace() throws {
        let target = try url("frak-x://result?action=share&title=Kettle+deal&text=Grab+it%21")
        #expect(sharingQueryValue(target, "title") == "Kettle deal")
        #expect(sharingQueryValue(target, "text") == "Grab it!")
    }

    @Test("an encoded plus stays a plus")
    func encodedPlusSurvives() throws {
        #expect(sharingQueryValue(try url("frak-x://result?action=share&text=a%2Bb"), "text") == "a+b")
    }

    @Test("newlines and emoji survive the round trip")
    func multiByteSurvives() throws {
        #expect(sharingQueryValue(try url("frak-x://result?text=one%0Atwo%20%F0%9F%98%80"), "text") == "one\ntwo 😀")
    }

    @Test("an absent key is nil, and a query-less url is nil")
    func absentIsNil() throws {
        #expect(sharingQueryValue(try url("frak-x://result?action=share"), "title") == nil)
        #expect(sharingQueryValue(try url("frak-x://result"), "action") == nil)
    }
}
