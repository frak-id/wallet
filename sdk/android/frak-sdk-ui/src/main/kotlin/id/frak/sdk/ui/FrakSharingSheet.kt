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
 * The sharing sheet: the hosted `/sharing` page, edge to edge in a bottom sheet. The sheet is
 * chrome only — a drag handle, a shape, a scrim. Share/Copy live in the page's own footer and
 * reach this sheet as page actions (see [SharingPageAction]).
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

    // Without a link there's nothing to fall back to either (SharingSheetState.build's own
    // null case) — a resolveConfig failure with a link already in hand does not reach here.
    LaunchedEffect(state.failure) {
        state.failure?.let(state::fail)
    }

    // Keyed on request/sessionId, not state.session: the budget has to cover prepare() itself,
    // since buildSharingLink/resolveConfig are network-bound and run before a session exists.
    // Timing from state.session becoming non-null was the earlier bug — worst case ~22s
    // against HttpClient.OVERALL_DEADLINE_MILLIS instead of this ~1.5s budget.
    LaunchedEffect(sessionId) { state.awaitLoadDeadline(PAGE_LOAD_DEADLINE_MILLIS) }

    DisposableEffect(Unit) { onDispose(state::release) }

    ModalBottomSheet(
        onDismissRequest = state::dismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        // The page paints the only surface here, so the sheet must not paint one behind it.
        // M3's default (surfaceContainerLow) showed as a grey mismatch against the page's
        // white at the corners and during scroll overshoot. The loading state below paints its
        // own surface.
        containerColor = Color.Transparent,
        // Drawn by hand inside the content so it floats over the page instead of reserving a
        // strip above it — in its own row it would render as a band of scrim, since the
        // container is transparent.
        dragHandle = null,
    ) {
        val session = state.session
        // A fraction, not a fixed dp: the hosted page's first screenful (reward card, product
        // cards, stepper, FAQ) needs the whole height, and there's no native chrome left to
        // subtract from it.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(clampSharingHeightFraction(heightFraction))
                    // The WebView is a rectangle; without this it squares off the sheet's top corners.
                    .clip(BottomSheetDefaults.ExpandedShape),
        ) {
            if (session == null) {
                // The sheet is already animating in; the page loads into it rather than
                // delaying it. This is the only moment with no page to show, so it paints M3's
                // own sheet colour (from BottomSheetDefaults, so it follows the host app's
                // theme) instead of a spinner floating on the scrim.
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

            // Over the page, not above it — scrolled content passing under a translucent pill
            // is ordinary for a sheet hosting a full-bleed surface.
            BottomSheetDefaults.DragHandle(modifier = Modifier.align(Alignment.TopCenter))
        }
    }
}

/** Fallback threshold: past this, skip the page and fire the native share sheet directly. */
private const val PAGE_LOAD_DEADLINE_MILLIS = 1_500L
