package id.frak.sdk.fixtures

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Loads the cross-platform golden fixture corpus from `sdk/core`: shared vectors that must be
 * byte-identical across TypeScript, Kotlin and Swift. Uses `org.json` (`testImplementation`,
 * stays out of the published POM); the stubbed Android `android.jar` also has an `org.json` on
 * the classpath but its methods all throw, so the real artifact is what services these calls.
 */
internal object GoldenFixtures {
    /** Bump means the envelope changed shape; a payload gaining a field is routine and needs no bump. */
    const val EXPECTED_FORMAT_VERSION: Int = 1

    /** Identity: the signed byte layout for `merge`/`ensure`/`install`/`sso`. */
    const val IDENTITY_PROOFS: String = "sdk/core/src/identity/fixtures/golden-proofs.json"

    /** FrakContext v2 codec vectors. Owned by the context corpus work. */
    const val CONTEXT_CODEC: String = "sdk/core/src/context/fixtures/golden-context.json"

    /** Reward selection and currency formatting vectors. */
    const val REWARDS: String = "sdk/core/src/rewards/fixtures/golden-rewards.json"

    /** Entries handed back as raw [JSONObject]s: only the envelope is a contract, payloads vary per concern. */
    internal data class Corpus(
        val path: String,
        val formatVersion: Int,
        val entries: List<JSONObject>,
    ) {
        val size: Int get() = entries.size

        /** `golden-proofs.json` predates the `name` convention and carries only `description`. */
        fun byName(name: String): JSONObject =
            entries.firstOrNull { it.optString("name") == name }
                ?: throw AssertionError(
                    "No fixture named \"$name\" in $path.\n" +
                        "Present: ${entries.mapNotNull { it.optString("name").ifEmpty { null } }}",
                )
    }

    /** Fails loudly when the file is absent; a suite that passes silently on a missing corpus proves nothing. */
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
                    append("This is a hard failure by design.")
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

        // Empty array parses cleanly and asserts nothing, same silent-pass failure as a missing file.
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

    /** Root identified by `sdk/core` plus a repo marker together: either alone is unreliable. */
    private fun repoRoot(): File {
        val starts =
            listOfNotNull(
                javaClass.protectionDomain
                    ?.codeSource
                    ?.location
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
