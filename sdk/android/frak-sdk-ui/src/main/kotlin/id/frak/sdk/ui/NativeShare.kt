package id.frak.sdk.ui

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle

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

    /**
     * Puts the install code on the clipboard so the wallet's six-character field can offer it.
     *
     * Marked sensitive from API 33 so the code is kept out of the clipboard preview the system
     * shows on paste. Android has no `expirationDate` equivalent — [expiresAtSeconds] is
     * carried for parity with iOS and to document the code's own lifetime, not because the
     * platform can enforce it. Less load-bearing here than on iOS: the Play referrer already
     * carries attribution deterministically, so this is a convenience, not the mechanism.
     */
    fun copyInstallCode(
        context: Context,
        code: String,
        @Suppress("UNUSED_PARAMETER") expiresAtSeconds: Long?,
    ): Boolean {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        val clip = ClipData.newPlainText(INSTALL_CODE_LABEL, code)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            clip.description.extras =
                PersistableBundle().apply {
                    putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                }
        }
        clipboard.setPrimaryClip(clip)
        return true
    }

    private const val CLIP_LABEL = "Frak sharing link"

    private const val INSTALL_CODE_LABEL = "Frak install code"
}
