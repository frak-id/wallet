package id.frak.sdk.ui

import android.app.Activity
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
                title?.let {
                    putExtra(Intent.EXTRA_TITLE, it)
                    // Mail targets read SUBJECT, not TITLE; without it a shared link arrives blank-subject.
                    putExtra(Intent.EXTRA_SUBJECT, it)
                }
            }
        val chooser = Intent.createChooser(send, title)
        // Only when there is no task to join: from an Activity, NEW_TASK parks the chooser in its
        // own recents entry and the user comes back to the wrong screen.
        if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { context.startActivity(chooser) }.isSuccess
    }

    /** Writes the sharing link to the clipboard. The page owns the confirmation feedback; there's nothing for a caller to decide with a return value. */
    fun copy(
        context: Context,
        link: String,
    ) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        clipboard.setPrimaryClip(ClipData.newPlainText(CLIP_LABEL, link))
    }

    /**
     * Puts the install code on the clipboard so the wallet's six-character field can offer it.
     * Marked sensitive from API 33 to keep it out of the system's clipboard-paste preview.
     * [expiresAtSeconds] is unused here — Android has no `expirationDate` equivalent — kept for
     * parity with iOS.
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
