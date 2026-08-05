import Foundation
import Testing

@Suite("GoldenFixtures")
struct GoldenFixturesTests {
    @Test("identity corpus loads, declares the expected envelope, and is non-empty")
    func identityCorpusLoads() throws {
        let corpus = try GoldenFixtures.load(GoldenFixtures.identityProofs)

        #expect(corpus.formatVersion == GoldenFixtures.expectedFormatVersion)
        #expect(corpus.count > 0)

        for entry in corpus.entries {
            let description = entry["description"] as? String
            #expect(description?.isEmpty == false)
        }
    }

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
