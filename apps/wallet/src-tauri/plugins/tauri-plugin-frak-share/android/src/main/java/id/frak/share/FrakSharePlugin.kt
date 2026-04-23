package id.frak.share

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Native Android share sheet for link payloads.
 *
 * Wraps `Intent.ACTION_SEND` with the typed extras Android expects so the
 * system chooser can render its rich preview header (API 29+):
 *   - `EXTRA_TEXT`  — "${text}\n${url}" (Android convention: URL lives inside
 *                     the shared text; receiving apps parse it out).
 *   - `EXTRA_TITLE` — brand/merchant title, shown in the chooser preview.
 *   - `EXTRA_SUBJECT` — same title; used by Gmail/email apps.
 *   - `ClipData` with thumbnail URI — optional `imageUrl` downloaded into the
 *                     app's cache and exposed via the existing FileProvider
 *                     (authority `${applicationId}.fileprovider`) so the
 *                     chooser renders a logo tile. The download is capped at
 *                     2 s — if it times out or fails the share still goes
 *                     through, just without a thumbnail.
 *
 * `Intent.ACTION_SEND` always resolves as soon as the chooser is presented;
 * Android doesn't report back whether the user completed the share, so the
 * promise resolves with `shared: true` once the chooser opens.
 */
@TauriPlugin
class FrakSharePlugin(activity: Activity) : Plugin(activity) {
    private val pluginActivity = activity
    private val imageLoader = Executors.newSingleThreadExecutor()

    @Command
    fun shareText(invoke: Invoke) {
        val args = invoke.getArgs()
        val url = args.getString("url")
        val text = args.getString("text")
        val title = args.getString("title")
        val imageUrl = args.getString("imageUrl")

        val hasUrl = !url.isNullOrEmpty()
        val hasText = !text.isNullOrEmpty()
        if (!hasUrl && !hasText) {
            invoke.reject("Missing 'url' or 'text' parameter")
            return
        }

        // Android convention: the URL lives inline in EXTRA_TEXT. Receiving
        // apps (Messages, WhatsApp, Slack, ...) parse it out and render a
        // link preview. Keep the body + url order because most apps truncate
        // long bodies and we always want the link to survive.
        // JSObject.getString() returns non-null with an empty-string default,
        // so we branch on has* rather than null-check.
        val shareBody = when {
            hasText && hasUrl -> "$text\n$url"
            hasUrl -> url
            else -> text
        }

        val thumbnailUri: Uri? = if (!imageUrl.isNullOrEmpty()) {
            resolveThumbnailUri(imageUrl)
        } else {
            null
        }

        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareBody)
            if (!title.isNullOrEmpty()) {
                putExtra(Intent.EXTRA_SUBJECT, title)
                // `EXTRA_TITLE` drives the chooser preview header on API 29+
                // and is ignored on older versions — safe to always set.
                putExtra(Intent.EXTRA_TITLE, title)
            }
            if (thumbnailUri != null) {
                // ClipData with a content:// URI lets the chooser render the
                // image as the preview tile. `FLAG_GRANT_READ_URI_PERMISSION`
                // is required so the chooser (running in a different process)
                // can read from our FileProvider.
                clipData = ClipData.newRawUri(title, thumbnailUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
        }

        try {
            // Passing `null` as the chooser title lets the system render its
            // own preview (title + thumbnail) — a hard-coded title would
            // replace that preview on API 29+.
            val chooser = Intent.createChooser(sendIntent, null)
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            pluginActivity.startActivity(chooser)

            val result = JSObject()
            result.put("shared", true)
            invoke.resolve(result)
        } catch (e: Exception) {
            invoke.reject(e.message ?: "Failed to open share sheet")
        }
    }

    /**
     * Downloads the thumbnail into the app cache and wraps it in a
     * FileProvider URI the chooser can read. Blocks the share for at most
     * [DOWNLOAD_TIMEOUT_MS] so the UX never stalls on a slow image host.
     */
    private fun resolveThumbnailUri(imageUrl: String): Uri? {
        return try {
            val future = imageLoader.submit<File?> { downloadImage(imageUrl) }
            val file = future.get(DOWNLOAD_TIMEOUT_MS, TimeUnit.MILLISECONDS) ?: return null
            FileProvider.getUriForFile(
                pluginActivity,
                "${pluginActivity.packageName}.fileprovider",
                file
            )
        } catch (e: Exception) {
            Log.w(TAG, "Thumbnail fetch failed, sharing without preview image", e)
            null
        }
    }

    private fun downloadImage(imageUrl: String): File? {
        val parsed = runCatching { URL(imageUrl) }.getOrNull() ?: return null
        val connection = (parsed.openConnection() as? HttpURLConnection) ?: return null
        connection.connectTimeout = 1_500
        connection.readTimeout = 1_500
        connection.instanceFollowRedirects = true
        return try {
            connection.connect()
            if (connection.responseCode !in 200..299) return null
            val extension = inferExtension(connection.contentType)
            val cacheDir = File(pluginActivity.cacheDir, "share").apply { mkdirs() }
            // Stable filename per URL so repeated shares hit the same cache entry.
            val file = File(cacheDir, "share-${imageUrl.hashCode()}.$extension")
            connection.inputStream.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            file
        } catch (e: Exception) {
            Log.w(TAG, "Unable to download share thumbnail", e)
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun inferExtension(contentType: String?): String {
        val lower = contentType?.lowercase(Locale.US) ?: return "img"
        return when {
            lower.contains("jpeg") || lower.contains("jpg") -> "jpg"
            lower.contains("png") -> "png"
            lower.contains("webp") -> "webp"
            lower.contains("gif") -> "gif"
            else -> "img"
        }
    }

    companion object {
        private const val TAG = "FrakSharePlugin"
        private const val DOWNLOAD_TIMEOUT_MS = 2_000L
    }
}
