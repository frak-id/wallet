package id.frak.sdk.config

/** [KeyValueStore] with no platform underneath: `SharedPreferences` throws on the JVM classpath. */
internal class InMemoryKeyValueStore : KeyValueStore {
    private val values = HashMap<String, String>()

    /** Counts reads, so a test can pin how many times storage was actually touched. */
    var getStringCalls: Int = 0
        private set

    override fun getString(key: String): String? {
        getStringCalls++
        return values[key]
    }

    override fun putString(
        key: String,
        value: String,
    ) {
        values[key] = value
    }

    override fun remove(key: String) {
        values.remove(key)
    }
}
