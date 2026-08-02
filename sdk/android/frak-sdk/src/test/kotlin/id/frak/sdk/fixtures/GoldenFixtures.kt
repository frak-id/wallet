package id.frak.sdk.fixtures

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Loads the cross-platform golden fixture corpus from `sdk/core`.
 *
 * See `docs/plans/native-sdk/04-golden-fixtures.md`. The corpus is the named
 * alternative to a shared core (`03-implementation-strategy.md` §1.6): three
 * concerns must be byte-identical across TypeScript, Kotlin and Swift, and the
 * vectors — not any one implementation — are the contract.
 *
 * ## Why `org.json` and not a real JSON library
 *
 * The SDK has a zero-third-party-runtime-dependency rule (`02` §5). This file is
 * test-only, so it may take a test-only dependency, but the choice still matters:
 * a dependency added to the wrong Gradle configuration leaks into the published
 * POM and becomes every merchant's problem.
 *
 * `org.json` is declared `testImplementation` in `frak-sdk/build.gradle.kts`, so
 * it cannot reach `components["release"]` and cannot appear in the POM.
 *
 * There is a trap here worth recording, because the obvious reading of "org.json
 * is on the Android classpath" is wrong. It *is* on the classpath — but for local
 * unit tests that classpath is the stubbed `android.jar`, whose every method body
 * throws:
 *
 * ```
 * java.lang.RuntimeException: Method getInt in org.json.JSONObject not mocked.
 * ```
 *
 * So `org.json` compiles with no dependency at all and then fails at runtime. The
 * real `org.json:json` artifact in test scope shadows the stub and works. This was
 * verified by execution, not assumed.
 *
 * The alternatives were weighed:
 *
 * - **kotlinx-serialization** — a new dependency *and* a Gradle plugin, and the
 *   plugin applies a compiler plugin to the whole module rather than to test
 *   source only. Disproportionate for parsing three files in test scope.
 * - **Hand-rolled parsing** — no dependency, but hand-written JSON parsers get
 *   string escapes wrong, and this corpus is *specifically* about invisible
 *   characters: `\u202f`, `\u00a0`. A parser with a subtly wrong `\u` path would
 *   corrupt the exact bytes the fixtures exist to protect, and would do it
 *   silently. Writing a parser to check the thing the parser is worst at is the
 *   wrong trade.
 *
 * `org.json` is public domain, ~150 KB, has no transitive dependencies, and is
 * already familiar to every Android developer.
 */
internal object GoldenFixtures {
    /**
     * The envelope version every fixture file in the corpus declares.
     *
     * A bump means the *envelope* changed shape and every loader needs attention —
     * not that a payload gained a field, which is routine and needs no bump.
     */
    const val EXPECTED_FORMAT_VERSION: Int = 1

    /** Identity: the signed byte layout for `merge`/`ensure`/`install`/`sso`. */
    const val IDENTITY_PROOFS: String = "sdk/core/src/identity/fixtures/golden-proofs.json"

    /** FrakContext v2 codec vectors. Owned by the context corpus work. */
    const val CONTEXT_CODEC: String = "sdk/core/src/context/fixtures/golden-context.json"

    /** Reward selection and currency formatting vectors. */
    const val REWARDS: String = "sdk/core/src/rewards/fixtures/golden-rewards.json"

    /**
     * A parsed fixture file: the envelope, validated, with payloads left opaque.
     *
     * Entries are handed back as raw [JSONObject]s deliberately. Only the envelope
     * is a contract between the corpus authors and this loader; payload fields
     * differ per concern and evolve independently, so typing them here would make
     * every payload change a change to this file.
     */
    internal data class Corpus(
        /** Repo-relative path, for failure messages that say which file is wrong. */
        val path: String,
        val formatVersion: Int,
        val entries: List<JSONObject>,
    ) {
        val size: Int get() = entries.size

        /**
         * The entry whose `name` is [name], or a failure naming what is present.
         *
         * `name` is the payload-level unique id used by the context and rewards
         * corpora. `golden-proofs.json` predates the convention and carries only
         * `description`; use [entries] directly for that file.
         */
        fun byName(name: String): JSONObject =
            entries.firstOrNull { it.optString("name") == name }
                ?: throw AssertionError(
                    "No fixture named \"$name\" in $path.\n" +
                        "Present: ${entries.mapNotNull { it.optString("name").ifEmpty { null } }}",
                )
    }

    /**
     * Loads and validates one fixture file.
     *
     * Fails loudly and specifically when the file is absent. A fixture suite that
     * silently passes when the corpus is missing is worse than no suite: it
     * reports the same green as a real run while asserting nothing, so a corpus
     * deleted by a bad merge looks exactly like a corpus that passes.
     *
     * @param repoRelativePath one of [IDENTITY_PROOFS], [CONTEXT_CODEC], [REWARDS]
     */
    fun load(repoRelativePath: String): Corpus {
        val root = repoRoot()
        val file = File(root, repoRelativePath)

        if (!file.isFile) {
            throw AssertionError(
                buildString {
                    append("Golden fixture corpus missing: $repoRelativePath\n")
                    append("  Looked for: ${file.absolutePath}\n")
                    append("  Repo root resolved to: ${root.absolutePath}\n\n")
                    append("The corpus lives in sdk/core, NOT inside this Android project, ")
                    append("and is generated — never hand-written.\n")
                    append("Regenerate with (from the repo root):\n")
                    append("  bun run --cwd sdk/core fixtures:generate           # identity\n")
                    append("  bun run --cwd sdk/core fixtures:generate:context   # codec\n")
                    append("  bun run --cwd sdk/core fixtures:generate:rewards   # rewards\n\n")
                    append("This is a hard failure by design. See ")
                    append("docs/plans/native-sdk/04-golden-fixtures.md.")
                },
            )
        }

        val text = file.readText()
        val root0 =
            try {
                JSONObject(text)
            } catch (e: Exception) {
                throw AssertionError(
                    "Golden fixture corpus is not valid JSON: $repoRelativePath\n" +
                        "  At: ${file.absolutePath}\n" +
                        "  ${e.message}\n" +
                        "Do not hand-edit fixtures — regenerate them.",
                    e,
                )
            }

        if (!root0.has("formatVersion")) {
            throw AssertionError(
                "Golden fixture corpus has no \"formatVersion\": $repoRelativePath\n" +
                    "Every file in the corpus shares the envelope " +
                    "{ formatVersion, fixtures }.",
            )
        }

        val formatVersion = root0.optInt("formatVersion", -1)
        if (formatVersion != EXPECTED_FORMAT_VERSION) {
            throw AssertionError(
                "Golden fixture corpus formatVersion is $formatVersion, expected " +
                    "$EXPECTED_FORMAT_VERSION: $repoRelativePath\n" +
                    "The envelope changed shape. Update this loader deliberately — " +
                    "do not relax the check.",
            )
        }

        val array: JSONArray =
            root0.optJSONArray("fixtures")
                ?: throw AssertionError(
                    "Golden fixture corpus has no \"fixtures\" array: $repoRelativePath\n" +
                        "Envelope is { formatVersion, fixtures }.",
                )

        // An empty array parses cleanly and asserts nothing — the same silent-pass
        // failure as a missing file, one step further in.
        if (array.length() == 0) {
            throw AssertionError(
                "Golden fixture corpus is empty: $repoRelativePath\n" +
                    "A corpus with no entries passes every test while proving nothing.",
            )
        }

        val entries =
            (0 until array.length()).map { i ->
                array.optJSONObject(i)
                    ?: throw AssertionError(
                        "Fixture at index $i is not an object: $repoRelativePath",
                    )
            }

        return Corpus(repoRelativePath, formatVersion, entries)
    }

    /**
     * Walks up from this class's location to the repository root.
     *
     * The corpus lives in `sdk/core`, outside the Gradle project, so neither test
     * resources nor `rootProject.projectDir` can reach it. Gradle's working
     * directory for a test JVM is the module directory, but that is a convention
     * rather than a guarantee, so the walk starts from the location this class was
     * actually loaded from and falls back to the working directory.
     *
     * The root is identified by `sdk/core` plus a repo marker together. `sdk/core`
     * alone would match a stray directory; `.git` alone breaks in a worktree or a
     * CI checkout that trims it.
     */
    private fun repoRoot(): File {
        val starts =
            listOfNotNull(
                javaClass.protectionDomain?.codeSource?.location
                    ?.toURI()
                    ?.let { File(it) },
                File(".").absoluteFile,
            )

        for (start in starts) {
            var dir: File? = if (start.isDirectory) start else start.parentFile
            while (dir != null) {
                if (File(dir, "sdk/core").isDirectory &&
                    (File(dir, ".git").exists() || File(dir, "package.json").isFile)
                ) {
                    return dir
                }
                dir = dir.parentFile
            }
        }

        throw AssertionError(
            "Could not locate the repository root from any of " +
                "${starts.map { it.absolutePath }}.\n" +
                "Looked upward for a directory containing sdk/core alongside " +
                ".git or package.json.\n" +
                "The golden fixture corpus lives in sdk/core, outside this Gradle " +
                "project, so it cannot be loaded as a test resource.",
        )
    }
}
