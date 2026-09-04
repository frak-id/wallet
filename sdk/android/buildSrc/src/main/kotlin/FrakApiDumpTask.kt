import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.work.DisableCachingByDefault

/**
 * Copies a freshly extracted ABI dump over the committed `api/<module>.api`, like BCV's own `apiDump`. `apiCheck`
 * reads this task's output with no dependency declared, so run them in separate invocations.
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
