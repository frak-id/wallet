package id.frak.example.android

import android.content.Context
import androidx.core.content.edit
import id.frak.sdk.core.FrakEnvironment

/**
 * A Frak stage the harness can run against, with the merchant id that exists on it. Each stage is
 * a separate backend deployment, so a merchant id is only resolvable on the one it was created on.
 */
enum class HarnessEnvironment(
    val label: String,
    val merchantId: String,
    val frakEnvironment: FrakEnvironment,
) {
    DEVELOPMENT(
        label = "Development",
        merchantId = "0a799880-ba54-4276-a734-db8721911bab",
        frakEnvironment = FrakEnvironment.Development,
    ),
    PRODUCTION(
        label = "Production",
        merchantId = "dab86a41-f685-470d-91c8-e87af5834af9",
        frakEnvironment = FrakEnvironment.Production,
    ),
    ;

    val backendOrigin: String get() = frakEnvironment.backend
}

/**
 * The selected stage, persisted so it survives the relaunch that applies it.
 *
 * Its own prefs file, never the SDK's: this is harness state, and the SDK's file also holds the
 * consent decision.
 */
object HarnessEnvironmentStore {
    private const val FILE_NAME = "frak-harness"
    private const val KEY = "environment"

    fun read(context: Context): HarnessEnvironment {
        val stored = prefs(context).getString(KEY, null) ?: return HarnessEnvironment.DEVELOPMENT
        return runCatching { HarnessEnvironment.valueOf(stored) }.getOrDefault(HarnessEnvironment.DEVELOPMENT)
    }

    fun write(
        context: Context,
        environment: HarnessEnvironment,
    ) {
        prefs(context).edit { putString(KEY, environment.name) }
    }

    private fun prefs(context: Context) = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
}
