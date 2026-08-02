package id.frak.sdk.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build

/** The two native actions in the sheet's footer — `ACTION_SEND` opens the real OS share sheet, unlike a web page. */
internal object NativeShare {
    fun share(
        context: Context,
        link: String,
        title: String?,
    ): Boolean {
        val send =
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, link)
                title?.let { putExtra(Intent.EXTRA_TITLE, it) }
            }
        val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(chooser) }.isSuccess
    }

    /** @return whether the SDK should show its own confirmation — Android 13+ already toasts clipboard writes. */
    fun copy(
        context: Context,
        link: String,
    ): Boolean {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        clipboard.setPrimaryClip(ClipData.newPlainText(CLIP_LABEL, link))
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
    }

    private const val CLIP_LABEL = "Frak sharing link"
}
