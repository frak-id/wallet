package id.frak.sdk.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest

/** Opens the Frak sharing sheet. Obtained from [rememberFrakSharingLauncher]. */
public class FrakSharingLauncher internal constructor(
    private val onResult: State<(SharingResult) -> Unit>,
) {
    internal var active: SharingRequest? by mutableStateOf(null)
        private set

    /** A second call while one is up reports [FrakError.AlreadyPresenting] rather than queueing or replacing. */
    public fun launch(request: SharingRequest) {
        if (active != null) {
            onResult.value(SharingResult.Failed(FrakError.AlreadyPresenting()))
            return
        }
        active = request
    }

    internal fun finish(result: SharingResult) {
        if (active == null) return // report once, even if failure/dismissal arrive from different callers
        active = null
        onResult.value(result)
    }
}

/**
 * Remembers a [FrakSharingLauncher] and hosts its sheet.
 *
 * [heightFraction] is the share of the screen the sheet takes, clamped to `0.3..1.0`. A
 * merchant whose page is shorter (no products, no FAQ) can trim it; the default leaves the
 * hosted page its whole first screenful.
 */
@Composable
public fun rememberFrakSharingLauncher(
    heightFraction: Float = FrakSharingDefaults.HEIGHT_FRACTION,
    onResult: (SharingResult) -> Unit = {},
): FrakSharingLauncher {
    val currentOnResult = rememberUpdatedState(onResult) // always calls the current lambda, not the captured one
    val launcher = remember { FrakSharingLauncher(currentOnResult) }

    WarmSharingWebView() // this composable is the share surface becoming visible

    launcher.active?.let { request ->
        FrakSharingSheet(
            request = request,
            heightFraction = heightFraction,
            onFinished = launcher::finish,
        )
    }

    return launcher
}
