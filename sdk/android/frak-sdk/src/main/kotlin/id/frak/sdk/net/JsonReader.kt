package id.frak.sdk.net

import id.frak.sdk.core.FrakError
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Typed, forgiving accessors over [JSONObject]. Uses [JSONObject.opt] plus a Kotlin cast rather
 * than `org.json`'s typed getters, which coerce differently on AOSP and the JVM impl used in
 * tests. Absent, null and wrong-typed optional fields all read as null rather than throwing.
 */
internal object JsonReader {
    fun parseObject(body: String): JSONObject =
        try {
            JSONObject(body)
        } catch (failure: JSONException) {
            throw FrakError.Decoding("expected a JSON object, got ${body.take(TRUNCATE_AT)}", failure)
        }

    /** Never throws; called on error paths where the body may be `text/plain` or empty. */
    fun errorCodeOrNull(body: String): String? = runCatching { string(JSONObject(body), "code") }.getOrNull()

    /** Non-empty string at [key], or null if absent, JSON null, empty, or not a string. Not trimmed. */
    fun string(
        source: JSONObject,
        key: String,
    ): String? = (source.opt(key) as? String)?.takeIf { it.isNotEmpty() }

    fun requireString(
        source: JSONObject,
        key: String,
        context: String,
    ): String = string(source, key) ?: throw FrakError.Decoding("$context is missing the required field \"$key\"")

    /** Always [Double]: JSON has one number type, so guessing `Int` risks a later decoding failure. */
    fun double(
        source: JSONObject,
        key: String,
    ): Double? = (source.opt(key) as? Number)?.toDouble()

    fun requireDouble(
        source: JSONObject,
        key: String,
        context: String,
    ): Double = double(source, key) ?: throw FrakError.Decoding("$context is missing the required field \"$key\"")

    /** Required, finite number at [key]: `org.json` accepts `NaN`/`Infinity`, and `1e999` becomes `Infinity`. */
    fun requireFiniteDouble(
        source: JSONObject,
        key: String,
        context: String,
    ): Double {
        val value = requireDouble(source, key, context)
        if (!value.isFinite()) {
            throw FrakError.Decoding("$context has a non-finite value for \"$key\": $value")
        }
        return value
    }

    /** Optional counterpart to [requireFiniteDouble]; a present non-finite value still throws. */
    fun finiteDouble(
        source: JSONObject,
        key: String,
        context: String,
    ): Double? {
        val value = double(source, key) ?: return null
        if (!value.isFinite()) {
            throw FrakError.Decoding("$context has a non-finite value for \"$key\": $value")
        }
        return value
    }

    fun boolean(
        source: JSONObject,
        key: String,
    ): Boolean? = source.opt(key) as? Boolean

    fun obj(
        source: JSONObject,
        key: String,
    ): JSONObject? = source.opt(key) as? JSONObject

    fun requireObject(
        source: JSONObject,
        key: String,
        context: String,
    ): JSONObject = obj(source, key) ?: throw FrakError.Decoding("$context is missing the required object \"$key\"")

    /** Skips non-object entries; absent and empty both yield `emptyList()`. */
    fun <T> objectArray(
        source: JSONObject,
        key: String,
        transform: (JSONObject) -> T,
    ): List<T> {
        val array = source.opt(key) as? JSONArray ?: return emptyList()
        return (0 until array.length()).mapNotNull { index ->
            (array.opt(index) as? JSONObject)?.let(transform)
        }
    }

    /** Non-string values are dropped, not coerced. */
    fun stringMap(
        source: JSONObject,
        key: String,
    ): Map<String, String> {
        val nested = obj(source, key) ?: return emptyMap()
        return nested
            .keys()
            .asSequence()
            .mapNotNull { entryKey -> (nested.opt(entryKey) as? String)?.let { entryKey to it } }
            .toMap()
    }

    fun <T> objectMap(
        source: JSONObject,
        key: String,
        transform: (JSONObject) -> T,
    ): Map<String, T> {
        val nested = obj(source, key) ?: return emptyMap()
        return nested
            .keys()
            .asSequence()
            .mapNotNull { entryKey -> (nested.opt(entryKey) as? JSONObject)?.let { entryKey to transform(it) } }
            .toMap()
    }

    private const val TRUNCATE_AT = 120
}
