import Foundation

/// Loads the cross-platform golden fixture corpus from `sdk/core`.
///
/// See `docs/plans/native-sdk/04-golden-fixtures.md`. The corpus is the named
/// alternative to a shared core (`03-implementation-strategy.md` §1.6): three concerns
/// must be byte-identical across TypeScript, Kotlin and Swift, and the vectors — not
/// any one implementation — are the contract.
///
/// There is no dependency question on this side. `JSONSerialization` is in Foundation,
/// so the corpus is parsed with nothing added to `Package.swift`, whose `dependencies`
/// is deliberately absent rather than empty.
///
/// `JSONSerialization` rather than `JSONDecoder`, deliberately: only the *envelope* is
/// a contract between the corpus authors and this loader. Payload fields differ per
/// concern and evolve independently, so `Codable` structs here would make every payload
/// change a change to this file. Entries are handed back as `[String: Any]` and each
/// conformance suite reads the keys it owns.
enum GoldenFixtures {
    /// The envelope version every fixture file in the corpus declares.
    ///
    /// A bump means the *envelope* changed shape and every loader needs attention — not
    /// that a payload gained a field, which is routine and needs no bump.
    static let expectedFormatVersion = 1

    /// Identity: the signed byte layout for `merge`/`ensure`/`install`/`sso`.
    static let identityProofs = "sdk/core/src/identity/fixtures/golden-proofs.json"

    /// FrakContext v2 codec vectors. Owned by the context corpus work.
    static let contextCodec = "sdk/core/src/context/fixtures/golden-context.json"

    /// Reward selection and currency formatting vectors.
    static let rewards = "sdk/core/src/rewards/fixtures/golden-rewards.json"

    /// A parsed fixture file: the envelope, validated, with payloads left opaque.
    struct Corpus {
        /// Repo-relative path, for failure messages that say which file is wrong.
        let path: String
        let formatVersion: Int
        let entries: [[String: Any]]

        var count: Int { entries.count }

        /// The entry whose `name` is `name`, or `nil`.
        ///
        /// `name` is the payload-level unique id used by the context and rewards
        /// corpora. `golden-proofs.json` predates the convention and carries only
        /// `description`; read `entries` directly for that file.
        func named(_ name: String) -> [String: Any]? {
            entries.first { $0["name"] as? String == name }
        }
    }

    /// Raised when the corpus is missing or malformed.
    ///
    /// A dedicated error type rather than a bare `String` so a suite cannot catch this
    /// by accident while meaning to catch something else.
    struct CorpusError: Error, CustomStringConvertible {
        let description: String
    }

    /// Loads and validates one fixture file.
    ///
    /// Throws — loudly and specifically — when the file is absent. A fixture suite that
    /// silently passes when the corpus is missing is worse than no suite: it reports the
    /// same green as a real run while asserting nothing, so a corpus deleted by a bad
    /// merge looks exactly like a corpus that passes.
    ///
    /// - Parameter repoRelativePath: one of `identityProofs`, `contextCodec`, `rewards`.
    /// - Returns: the validated envelope, with payloads left opaque.
    /// - Throws: `CorpusError` when the repo root cannot be found, the file is missing,
    ///   the JSON is malformed, the `formatVersion` is unexpected, or `fixtures` is
    ///   absent or empty.
    static func load(_ repoRelativePath: String) throws -> Corpus {
        let root = try repoRoot()
        let url = root.appendingPathComponent(repoRelativePath)

        guard FileManager.default.fileExists(atPath: url.path) else {
            throw CorpusError(
                description: """
                    Golden fixture corpus missing: \(repoRelativePath)
                      Looked for: \(url.path)
                      Repo root resolved to: \(root.path)

                    The corpus lives in sdk/core, NOT inside this Swift package, and is \
                    generated — never hand-written.
                    Regenerate with (from the repo root):
                      bun run --cwd sdk/core fixtures:generate           # identity
                      bun run --cwd sdk/core fixtures:generate:context   # codec
                      bun run --cwd sdk/core fixtures:generate:rewards   # rewards

                    This is a hard failure by design. \
                    See docs/plans/native-sdk/04-golden-fixtures.md.
                    """
            )
        }

        let data = try Data(contentsOf: url)

        let parsed: Any
        do {
            parsed = try JSONSerialization.jsonObject(with: data)
        } catch {
            throw CorpusError(
                description: """
                    Golden fixture corpus is not valid JSON: \(repoRelativePath)
                      At: \(url.path)
                      \(error)
                    Do not hand-edit fixtures — regenerate them.
                    """
            )
        }

        guard let object = parsed as? [String: Any] else {
            throw CorpusError(
                description:
                    "Golden fixture corpus root is not a JSON object: \(repoRelativePath)"
            )
        }

        guard let formatVersion = object["formatVersion"] as? Int else {
            throw CorpusError(
                description: """
                    Golden fixture corpus has no integer "formatVersion": \
                    \(repoRelativePath)
                    Every file in the corpus shares the envelope \
                    { formatVersion, fixtures }.
                    """
            )
        }

        guard formatVersion == expectedFormatVersion else {
            throw CorpusError(
                description: """
                    Golden fixture corpus formatVersion is \(formatVersion), expected \
                    \(expectedFormatVersion): \(repoRelativePath)
                    The envelope changed shape. Update this loader deliberately — do not \
                    relax the check.
                    """
            )
        }

        guard let fixtures = object["fixtures"] as? [Any] else {
            throw CorpusError(
                description: """
                    Golden fixture corpus has no "fixtures" array: \(repoRelativePath)
                    Envelope is { formatVersion, fixtures }.
                    """
            )
        }

        // An empty array parses cleanly and asserts nothing — the same silent-pass
        // failure as a missing file, one step further in.
        guard !fixtures.isEmpty else {
            throw CorpusError(
                description: """
                    Golden fixture corpus is empty: \(repoRelativePath)
                    A corpus with no entries passes every test while proving nothing.
                    """
            )
        }

        let entries: [[String: Any]] = try fixtures.enumerated().map { index, element in
            guard let entry = element as? [String: Any] else {
                throw CorpusError(
                    description:
                        "Fixture at index \(index) is not an object: \(repoRelativePath)"
                )
            }
            return entry
        }

        return Corpus(path: repoRelativePath, formatVersion: formatVersion, entries: entries)
    }

    /// Walks up from this source file to the repository root.
    ///
    /// The corpus lives in `sdk/core`, outside the Swift package, so `Bundle.module` and
    /// SwiftPM resources cannot reach it. The walk starts at `#filePath` rather than the
    /// working directory: `swift test` inherits whatever directory the caller happened to
    /// be in, while `#filePath` is baked in at compile time and is correct regardless.
    ///
    /// The root is identified by `sdk/core` plus a repo marker together. `sdk/core` alone
    /// would match a stray directory; `.git` alone breaks in a worktree or a CI checkout
    /// that trims it.
    static func repoRoot(from filePath: String = #filePath) throws -> URL {
        let fileManager = FileManager.default
        var directory = URL(fileURLWithPath: filePath).deletingLastPathComponent()

        while directory.path != "/" {
            var isDirectory: ObjCBool = false
            let core = directory.appendingPathComponent("sdk/core")
            let hasCore =
                fileManager.fileExists(atPath: core.path, isDirectory: &isDirectory)
                && isDirectory.boolValue

            let hasMarker =
                fileManager.fileExists(
                    atPath: directory.appendingPathComponent(".git").path
                )
                || fileManager.fileExists(
                    atPath: directory.appendingPathComponent("package.json").path
                )

            if hasCore && hasMarker {
                return directory
            }
            directory = directory.deletingLastPathComponent()
        }

        throw CorpusError(
            description: """
                Could not locate the repository root by walking up from \(filePath).
                Looked upward for a directory containing sdk/core alongside .git or \
                package.json.
                The golden fixture corpus lives in sdk/core, outside this Swift package, \
                so it cannot be loaded as a bundle resource.
                """
        )
    }
}
