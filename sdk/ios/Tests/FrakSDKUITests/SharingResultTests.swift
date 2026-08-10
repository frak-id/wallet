import FrakSDK
import Testing

@testable import FrakSDKUI

@Suite("SharingResult")
struct SharingResultTests {
    private static let allResults: [SharingResult] = [
        .shared(link: "https://example.com"),
        .copied(link: "https://example.com"),
        .installStarted,
        .dismissed,
        .failed(.internalFailure(message: "boom")),
    ]

    @Test("every case maps to its own kind, and every kind is reachable")
    func kindsAreTotalAndDistinct() {
        let kinds = Self.allResults.map(\.kind)
        #expect(Set(kinds).count == kinds.count)
        #expect(Set(kinds) == Set(SharingResult.Kind.allCases))
    }

    /// Spelled out, not derived: nothing but this test and its Kotlin twin keeps the two in step.
    @Test("kind raw values are the strings Android also emits")
    func rawValuesMatchAndroid() {
        #expect(SharingResult.Kind.shared.rawValue == "shared")
        #expect(SharingResult.Kind.copied.rawValue == "copied")
        #expect(SharingResult.Kind.installStarted.rawValue == "installStarted")
        #expect(SharingResult.Kind.dismissed.rawValue == "dismissed")
        #expect(SharingResult.Kind.failed.rawValue == "failed")
    }

    /// A session can produce several outcomes; the caller is told the most significant.
    @Test("ranks install above a share, and a share above a dismissal")
    func ranksOutcomes() {
        #expect(SharingResult.installStarted.significance > SharingResult.shared(link: "l").significance)
        #expect(SharingResult.shared(link: "l").significance > SharingResult.dismissed.significance)
        #expect(SharingResult.copied(link: "l").significance == SharingResult.shared(link: "l").significance)
        #expect(SharingResult.dismissed.significance > SharingResult.failed(.notInitialized).significance)
    }
}
