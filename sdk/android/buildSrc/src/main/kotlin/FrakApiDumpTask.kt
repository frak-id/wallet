import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

/**
 * Copies a freshly extracted ABI dump over the committed `api/<module>.api`, which is what BCV's own
 * `apiDump` does.
 *
 * A task class rather than a `Copy`, and that is not fussiness. `Copy`'s output is a *directory*, so
 * `api/` would become a task output in the source tree: anything else put there would enter this
 * task's stale-output handling, and — the real problem — `apiCheck` reads `api/<module>.api` from
 * inside that directory with no dependency between the two, which Gradle rejects as an implicit
 * dependency the moment anyone runs `apiDump` and `apiCheck` in one invocation. An `@OutputFile`
 * naming exactly one file has neither problem. BCV's own dump task and the `android-bcv-bridge`
 * reference implementation both do it this way.
 *
 * Both properties are managed, and the action reads nothing but them, so it is configuration-cache
 * safe.
 */
@DisableCachingByDefault(because = "A trivial copy of a generated file over a committed one")
abstract class FrakApiDumpTask : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val generatedApiFile: RegularFileProperty

    @get:OutputFile
    abstract val committedApiFile: RegularFileProperty

    @TaskAction
    fun dump() {
        val committed = committedApiFile.get().asFile
        committed.parentFile?.mkdirs()
        generatedApiFile.get().asFile.copyTo(committed, overwrite = true)
    }
}
