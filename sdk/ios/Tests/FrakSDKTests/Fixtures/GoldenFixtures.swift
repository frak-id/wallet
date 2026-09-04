import Foundation

/// Loads the cross-platform golden fixture corpus from `sdk/core`. Uses `JSONSerialization`,
/// not `Codable`: only the envelope is a contract, payload fields evolve independently, and a
/// `Codable` struct would make every payload change a change to this file.
enum GoldenFixtures {
    /// A bump means the envelope changed shape; a payload gaining a field is routine
    /// and needs no bump.
    static let expectedFormatVersion = 1

    /// Identity: the signed byte layout for `merge`/`ensure`/`install`/`sso`.
    static let identityProofs = "sdk/core/src/identity/fixtures/golden-proofs.json"

    /// FrakContext v2 codec vectors.
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

        /// `name` is the payload-level id used by the context and rewards corpora;
        /// `golden-proofs.json` predates it and carries only `description`.
        func named(_ name: String) -> [String: Any]? {
            entries.first { $0["name"] as? String == name }
        }
    }

    /// A dedicated error type rather than a bare `String`, so a suite cannot catch this
    /// by accident while meaning to catch something else.
    struct CorpusError: Error, CustomStringConvertible {
        let description: String
    }

    /// Loads and validates one fixture file, throwing `CorpusError` loudly and
    /// specifically rather than passing silently when the corpus is missing.
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

                    This is a hard failure by design.
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

    /// Walks up from this source file to the repository root, starting at `#filePath` rather
    /// than the working directory (which `swift test` inherits arbitrarily). Requires both
    /// `sdk/core` and a repo marker (`.git`/`package.json`), since either alone can produce a
    /// false match.
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
