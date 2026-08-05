package id.frak.sdk.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest

/** Starts a session at the tap. Null before `Frak.initialize`, which has no wallet origin to load. */
internal typealias SharingPresentationOpener = (SharingRequest, (SharingResult) -> Unit) -> SharingPresentation?

/** Opens the Frak sharing sheet. Obtained from [rememberFrakSharingLauncher]. */
public class FrakSharingLauncher internal constructor(
    private val onResult: State<(SharingResult) -> Unit>,
    /**
     * Starts the session's work — pooled view, build, navigation — synchronously inside [launch],
     * before the sheet composes. See [SharingPresentation].
     */
    private val opener: State<SharingPresentationOpener> = mutableStateOf({ _, _ -> null }),
) {
    internal var active: SharingRequest? by mutableStateOf(null)
        private set

    /** The session [active] is running. Null when Frak was not initialized; the sheet reports that. */
    internal var presentation: SharingPresentation? by mutableStateOf(null)
        private set

    /** A second call while one is up reports [FrakError.AlreadyPresenting] rather than queueing or replacing. */
    public fun launch(request: SharingRequest) {
        if (active != null) {
            onResult.value(SharingResult.Failed(FrakError.AlreadyPresenting()))
            return
        }
        active = request
        // Before the sheet exists: this is the whole point of the split. The page load is in
        // flight by the time ModalBottomSheet starts building its window.
        presentation = opener.value(request, ::finish)
    }

    internal fun finish(result: SharingResult) {
        if (active == null) return // report once, even if failure/dismissal arrive from different callers
        active = null
        val finished = presentation
        presentation = null
        // A session that reported before its first frame has no sheet to dispose it; without this
        // its pooled view would stay lent forever and every later sheet would run cold.
        finished?.disposeIfUnpresented()
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

    // This composable existing is the share surface becoming visible, which is the earliest
    // honest moment to start warming: the web view against the wallet origin, and the
    // identity/config reads the sheet cannot build a URL without.
    val pool = rememberSharingWebViewPool()
    WarmSharingData(pool)

    val context = LocalContext.current
    // Deliberately this composable's scope, not the sheet's — it outlives any one sheet, so a
    // track() still in flight when the sheet closes is not cancelled by the closing.
    val scope = rememberCoroutineScope()

    val opener =
        rememberUpdatedState<SharingPresentationOpener>({ request, onFinished ->
            pool?.let { SharingPresentation.start(it, context, scope, request, onFinished) }
        })

    val launcher = remember { FrakSharingLauncher(currentOnResult, opener) }

    launcher.active?.let { request ->
        val presentation = launcher.presentation
        if (presentation == null) {
            // Frak.initialize has not run: no wallet origin to load and no client to build a link
            // from. Report it rather than present an empty sheet.
            LaunchedEffect(request) {
                launcher.finish(SharingResult.Failed(FrakError.NotInitialized()))
            }
        } else {
            FrakSharingSheet(presentation = presentation, heightFraction = heightFraction)
        }
    }

    return launcher
}
