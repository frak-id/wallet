package id.frak.sdk.config

import android.content.Context

/** SDK's persistence surface. Interface so `SharedPreferences`, which throws on the unit-test classpath, stays a test seam. */
internal interface KeyValueStore {
    fun getString(key: String): String?

    fun putString(
        key: String,
        value: String,
    )

    fun remove(key: String)
}

/**
 * [KeyValueStore] backed by an SDK-owned `SharedPreferences` file. Opened lazily on first use,
 * not at construction, since construction happens under `Frak.initialize` (no cold-start I/O).
 */
internal class SharedPreferencesStore(
    context: Context,
    private val fileName: String = FILE_NAME,
) : KeyValueStore {
    private val appContext = context.applicationContext

    private val preferences by lazy {
        appContext.getSharedPreferences(fileName, Context.MODE_PRIVATE)
    }

    override fun getString(key: String): String? = preferences.getString(key, null)

    override fun putString(
        key: String,
        value: String,
    ) {
        // apply, not commit: a write lost to a process kill just costs one extra network call.
        preferences.edit().putString(key, value).apply()
    }

    override fun remove(key: String) {
        preferences.edit().remove(key).apply()
    }

    companion object {
        const val FILE_NAME: String = "id.frak.sdk.config"
    }
}
