package id.frak.sdk.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import id.frak.sdk.sharing.SharingRequest
import java.util.UUID

/**
 * The sharing sheet: the hosted `/sharing` page, edge to edge in a bottom sheet.
 *
 * The split is deliberate (02 §1), but it is narrower than it once was. What the user can
 * feel is native — the sheet animates in immediately, and Share opens the real OS share
 * sheet with their own apps and contacts, which a web page cannot reach. What the user
 * *sees* is all page, including the Copy and Share buttons: those now live in the page's own
 * footer and reach this sheet as `share`/`copy` page actions (see [SharingPageAction]).
 *
 * Everything native above and below the page has gone with them. A title bar duplicated a
 * header the page already draws, and a Compose footer under a web footer meant two type
 * scales, two button shapes and two surfaces stacked in one sheet — the confirmation screen,
 * whose CTAs were always the page's, was visibly the better half. The sheet is now chrome:
 * a drag handle, a shape, and a scrim.
 *
 * Presented through [rememberFrakSharingLauncher] rather than directly, so re-entrancy and
 * result aggregation have one owner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FrakSharingSheet(
    request: SharingRequest,
    heightFraction: Float,
    onFinished: (SharingResult) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessionId = remember { UUID.randomUUID().toString() }

    val state =
        remember {
            SharingSheetState(
                scope = scope,
                context = context,
                sessionId = sessionId,
                onFinished = onFinished,
            )
        }

    LaunchedEffect(request) { state.prepare(request) }

    // Nothing to fall back to: without a link there is no share to make at all
    // (`SharingSheetState.build`'s own null case), so the tier-3 native
    // fallback does not apply either — a `resolveConfig` failure with a link
    // already in hand does NOT reach here, see `build`'s doc.
    LaunchedEffect(state.failure) {
        state.failure?.let(state::fail)
    }

    // 03 §3's latency gate, keyed on `request`/`sessionId` (constant for this
    // sheet's lifetime) rather than `state.session`: the budget has to cover
    // `prepare()` itself — `buildSharingLink`/`resolveConfig` are both
    // network-bound and run *before* a session exists — not just the page's
    // own load once one does. `awaitLoadDeadline` is what races the two; see
    // its doc for why this cannot simply time from `state.session` becoming
    // non-null, which was the bug (worst case ~22s against
    // `HttpClient.OVERALL_DEADLINE_MILLIS` rather than this ~1.5s budget).
    LaunchedEffect(sessionId) { state.awaitLoadDeadline(PAGE_LOAD_DEADLINE_MILLIS) }

    DisposableEffect(Unit) { onDispose(state::release) }

    ModalBottomSheet(
        onDismissRequest = state::dismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        // The page paints the only surface in this sheet, so the sheet must not paint one of
        // its own behind it. M3's default here is `surfaceContainerLow`, a light grey that sat
        // visibly wrong against the page's white wherever the page did not reach — the corners,
        // the handle strip, and every scroll overshoot. Transparent also means the rounded
        // corners below cut to the scrim rather than to another colour, which is what a sheet
        // corner is supposed to do. The loading state paints its own surface; see below.
        containerColor = Color.Transparent,
        // Drawn by hand inside the content instead, so it floats over the page rather than
        // reserving a strip of sheet above it. A handle in its own row is a band of container
        // colour, and with the container transparent that band would be scrim.
        dragHandle = null,
    ) {
        val session = state.session
        // A fraction of what the sheet is allowed to be, not a fixed dp: the hosted page is a
        // full-page React app (reward card, product cards, stepper, FAQ) whose first screenful
        // is taller than the 480dp this used to reserve, so the sheet opened clipped on every
        // device. The page now gets all of it — there is no native chrome left to subtract.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(clampSharingHeightFraction(heightFraction))
                    // The WebView is a rectangle and would square off the sheet's top corners
                    // without this, which is exactly the seam `containerColor` above removes.
                    .clip(BottomSheetDefaults.ExpandedShape),
        ) {
            if (session == null) {
                // The sheet is already on screen and animating; the page loads into it rather
                // than delaying it. This is the one moment the sheet has no page to show, so
                // it paints M3's own sheet colour for it — a spinner floating on the scrim
                // would read as a rendering bug rather than as loading. Taken from
                // `BottomSheetDefaults` rather than hard-coded, so it still follows the host
                // app's theme (including dark) the way the transparent sheet above cannot.
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = BottomSheetDefaults.ContainerColor,
                ) {
                    Box(contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            } else {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { viewContext ->
                        createSharingWebView(
                            context = viewContext,
                            walletOrigin = session.walletOrigin,
                            returnScheme = session.returnScheme,
                            sessionId = sessionId,
                            onAction = state::onPageAction,
                            onPageReady = state::onPageReady,
                            onLoadFailed = state::onPageUnavailable,
                            onOpenExternal = state::openExternally,
                        ).also(state::attach)
                    },
                )
            }

            // Over the page, not above it. The page's own top padding is what it lands on, and
            // scrolled content passing under a translucent pill is the ordinary behaviour of
            // every sheet that hosts a full-bleed surface.
            BottomSheetDefaults.DragHandle(modifier = Modifier.align(Alignment.TopCenter))
        }
    }
}

/**
 * 03 §3's fallback threshold: "> 1.5s → skip the page, fire the native share
 * sheet directly". Taken as written rather than the p95 target doubled — the
 * previous 2s here was that doubling, but it was also timed from the wrong
 * point (see `awaitLoadDeadline`'s use above), so there is no longer a reason
 * to pad it independently of the plan's own number.
 */
private const val PAGE_LOAD_DEADLINE_MILLIS = 1_500L
