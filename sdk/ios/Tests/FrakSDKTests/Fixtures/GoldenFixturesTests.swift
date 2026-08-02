import Foundation
import Testing

/// Proves the loader mechanism works, nothing more.
///
/// This asserts against `golden-proofs.json` because it is the one corpus file that
/// exists today. There are deliberately no assertions about SDK behaviour here: none of
/// the identity, codec or reward code exists yet, and a test asserting against absent
/// behaviour would be theatre. What must be verified now is that the corpus can be
/// *found and parsed from a `swift test` process* — the part that is environment
/// -dependent and would otherwise be discovered later.
///
/// The conformance suites land with the code they cover.
///
/// Swift Testing rather than XCTest, deliberately: XCTest's Swift overlay does not link
/// at the `arm64-apple-ios15.0-simulator` triple from SwiftPM. See `scripts/run.sh`.
@Suite("GoldenFixtures")
struct GoldenFixturesTests {
    @Test("identity corpus loads, declares the expected envelope, and is non-empty")
    func identityCorpusLoads() throws {
        let corpus = try GoldenFixtures.load(GoldenFixtures.identityProofs)

        #expect(corpus.formatVersion == GoldenFixtures.expectedFormatVersion)
        #expect(corpus.count > 0)

        // Every entry is an object carrying the human label the identity corpus uses.
        // Asserting one payload key keeps this honest: it proves entries were really
        // parsed rather than counted as opaque blobs.
        for entry in corpus.entries {
            let description = entry["description"] as? String
            #expect(description?.isEmpty == false)
        }
    }

    /// The failure path is the whole point of the loader, so it is tested rather than
    /// assumed. If this regressed, every future conformance suite would go green against
    /// a corpus that was not there.
    @Test("a missing corpus fails loudly rather than skipping")
    func missingCorpusFailsLoudly() {
        #expect(throws: GoldenFixtures.CorpusError.self) {
            try GoldenFixtures.load("sdk/core/src/identity/fixtures/does-not-exist.json")
        }

        do {
            _ = try GoldenFixtures.load(
                "sdk/core/src/identity/fixtures/does-not-exist.json"
            )
            Issue.record("expected a CorpusError")
        } catch let error as GoldenFixtures.CorpusError {
            #expect(error.description.contains("does-not-exist.json"))
            #expect(error.description.contains("fixtures:generate"))
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }
}
