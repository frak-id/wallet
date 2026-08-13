package id.frak.sdk.ui

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.ComponentDialog
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat

/**
 * The window the sheet lives in. Everything configured here exists to stop the platform drawing
 * something the composition draws itself; get one wrong and it shows up as a flash or a clipped
 * drag rather than a crash.
 *
 * The caller still owns `show()` and `dismiss()` — this only builds it.
 */
internal fun createSharingSheetDialog(
    activity: ComponentActivity,
    content: View,
    onBackPressed: () -> Unit,
): ComponentDialog {
    // ComponentDialog, not Dialog: `setContentView` installs the ViewTree owners `AbstractComposeView`
    // requires, and brings an `OnBackPressedDispatcher`. A platform translucent theme, because every
    // standard dialog theme sets `windowIsFloating`, which would defeat the MATCH_PARENT below.
    val dialog = ComponentDialog(activity, android.R.style.Theme_Translucent_NoTitleBar)
    dialog.setContentView(content)
    dialog.setCancelable(true)
    // Never fires with a MATCH_PARENT window — every touch is inside it. The scrim is a Compose hit
    // target instead; see [FrakSharingSheet].
    dialog.setCanceledOnTouchOutside(false)
    dialog.onBackPressedDispatcher.addCallback(
        object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = onBackPressed()
        },
    )
    dialog.window?.applySheetWindowStyle()
    return dialog
}

private fun android.view.Window.applySheetWindowStyle() {
    // Full-screen, not wrap-content: drag-to-dismiss and the exit animation translate the sheet
    // down by its whole height, which a window sized to the sheet would clip.
    setLayout(MATCH_PARENT, MATCH_PARENT)
    setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
    // The platform theme's own fade would race the sheet's slide-in.
    setWindowAnimations(0)
    // FLAG_DIM_BEHIND is deliberately not set: a window dim is constant, so it would pop in and
    // out while the sheet is still sliding. The scrim is drawn in the composition instead.
    setDimAmount(0f)
    // Must precede enableEdgeToEdge, which sets the bar colours:
    // `Theme_Translucent_NoTitleBar` leaves `windowDrawsSystemBarBackgrounds` unset, and without
    // it those setters are ignored, so both bars stay opaque black while the sheet is up.
    addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    // Transparent bars and cutout handling down to API 16. A Dialog is a child window with no
    // independent `windowOptOutEdgeToEdgeEnforcement`, so on Android 15+ it cooperates with the
    // host's insets contract rather than opting out. Light icons already read against the scrim.
    WindowCompat.enableEdgeToEdge(this)
}
