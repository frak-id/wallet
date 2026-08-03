package id.frak.sdk.net

import id.frak.sdk.core.FrakError
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * Typed, forgiving accessors over [JSONObject]. Never uses `org.json`'s typed getters
 * (`getString`/etc.): AOSP and the JVM reference impl used in tests disagree on coercion, so
 * [JSONObject.opt] plus a Kotlin cast is the one ruleset that holds in both. Absent, null, and
 * wrong-typed optional fields all read as null rather than throwing.
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

    /** Non-empty string at [key], or null if absent, JSON null, blank, or not a string. */
    fun string(
        source: JSONObject,
        key: String,
    ): String? = (source.opt(key) as? String)?.takeIf { it.isNotEmpty() }

    /** Required string at [key], or a [FrakError.Decoding] naming what is missing. */
    fun requireString(
        source: JSONObject,
        key: String,
        context: String,
    ): String = string(source, key) ?: throw FrakError.Decoding("$context is missing the required field \"$key\"")

    /** Always [Double]: JSON has one number type, guessing `Int` risks a later decoding failure. */
    fun double(
        source: JSONObject,
        key: String,
    ): Double? = (source.opt(key) as? Number)?.toDouble()

    /** Required number at [key], or a [FrakError.Decoding] naming it. */
    fun requireDouble(
        source: JSONObject,
        key: String,
        context: String,
    ): Double = double(source, key) ?: throw FrakError.Decoding("$context is missing the required field \"$key\"")

    /**
     * Required, finite number at [key] (N1): a wire value of `NaN`/`Infinity` is technically
     * parseable — `org.json` accepts those literals, and a numeric literal that overflows a
     * `Double` (e.g. `1e999`) silently becomes `Infinity` on both `org.json` and AOSP's parser —
     * but neither is ever a legitimate monetary amount, and every arithmetic/formatting consumer
     * downstream assumes finiteness silently.
     */
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

    /**
     * Optional counterpart to [requireFiniteDouble] (N1): absent still reads as `null`, but a
     * *present* `NaN`/`Infinity` value throws rather than silently carrying a non-finite number
     * into display or comparison arithmetic — the same justification as [requireFiniteDouble],
     * just for a field the wire is allowed to omit.
     */
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

    /** Boolean at [key], or null. Not coerced from `"true"` or `1`. */
    fun boolean(
        source: JSONObject,
        key: String,
    ): Boolean? = source.opt(key) as? Boolean

    /** Nested object at [key], or null when absent, JSON null, or not an object. */
    fun obj(
        source: JSONObject,
        key: String,
    ): JSONObject? = source.opt(key) as? JSONObject

    /** Required nested object at [key], or a [FrakError.Decoding] naming it. */
    fun requireObject(
        source: JSONObject,
        key: String,
        context: String,
    ): JSONObject = obj(source, key) ?: throw FrakError.Decoding("$context is missing the required object \"$key\"")

    /** Maps the array at [key] with [transform], skipping non-object entries. Absent/empty both yield `emptyList()`. */
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

    /** Every `String`-valued entry of the object at [key]. Non-string values are dropped, not coerced. */
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

    /** Maps every object-valued entry of the object at [key]. */
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

    /** How much of an unparseable body makes it into an error message. */
    private const val TRUNCATE_AT = 120
}
