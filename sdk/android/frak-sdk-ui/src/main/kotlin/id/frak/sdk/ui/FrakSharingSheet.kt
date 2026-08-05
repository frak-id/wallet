package id.frak.sdk.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.roundToInt

/**
 * The sharing sheet: the hosted `/sharing` page, edge to edge in a bottom sheet. The sheet is
 * chrome only — a grab strip, a shape, a scrim. Share/Copy live in the page's own footer and
 * reach this sheet as page actions (see [SharingPageAction]).
 *
 * Presented through [rememberFrakSharingLauncher] rather than directly, so re-entrancy and
 * result aggregation have one owner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FrakSharingSheet(
    presentation: SharingPresentation,
    heightFraction: Float,
) {
    val scope = rememberCoroutineScope()
    val state = presentation.state
    val handle = presentation.handle

    // Without a link there's nothing to fall back to either (SharingSheetState.build's own
    // null case) — a resolveConfig failure with a link already in hand does not reach here.
    LaunchedEffect(state.failure) {
        state.failure?.let(state::fail)
    }

    // Bounds how long the skeleton may cover the page. postVisualStateCallback is the real
    // paint signal; this is what happens when one never arrives. Short once the document has
    // finished, long enough otherwise that the tier-3 deadline settles the sheet first.
    LaunchedEffect(state.pageLoaded) {
        delay(if (state.pageLoaded) SKELETON_GRACE_MILLIS else SKELETON_MAX_HOLD_MILLIS)
        state.onPageVisible()
    }

    DisposableEffect(presentation) {
        // From here the sheet owns the session's teardown; before this frame the launcher did.
        presentation.onPresented()
        onDispose(presentation::dispose)
    }

    // How far the user has dragged the sheet down by its grab strip. The sheet's own drag is
    // off (see sheetGesturesEnabled below), so this is the only thing that moves it.
    val dragOffset = remember { Animatable(0f) }
    var sheetHeightPx by remember { mutableIntStateOf(0) }

    ModalBottomSheet(
        onDismissRequest = state::dismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        // The whole sheet is draggable by default, which put it in a permanent race with the
        // web view for every vertical gesture — the page scrolls an inner `height: 100dvh`
        // container, so the WebView's own scroll offset never moves and no heuristic on this
        // side can tell "the page wants this" from "the sheet does". Ownership is explicit
        // instead: the page gets every gesture that lands on it, the grab strip gets the rest.
        sheetGesturesEnabled = false,
        // The page paints the only surface here, so the sheet must not paint one behind it.
        // M3's default (surfaceContainerLow) showed as a grey mismatch against the page's
        // white at the corners and during scroll overshoot. The skeleton below paints its
        // own surface.
        containerColor = Color.Transparent,
        // Drawn by hand inside the content so it floats over the page instead of reserving a
        // strip above it — in its own row it would render as a band of scrim, since the
        // container is transparent.
        dragHandle = null,
    ) {
        // A fraction, not a fixed dp: the hosted page's first screenful (reward card, product
        // cards, stepper, FAQ) needs the whole height, and there's no native chrome left to
        // subtract from it.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(clampSharingHeightFraction(heightFraction))
                    .onSizeChanged { sheetHeightPx = it.height }
                    // The container is transparent, so translating the content *is* translating
                    // the visible sheet. Before the clip, so the shape travels with it.
                    .offset { IntOffset(0, dragOffset.value.roundToInt()) }
                    // The WebView is a rectangle; without this it squares off the sheet's top corners.
                    .clip(BottomSheetDefaults.ExpandedShape),
        ) {
            // Composed from the first frame rather than waiting on the session: a pooled view
            // is already warm, and attaching and laying it out at the real size now means the
            // session's own load lands into a settled viewport instead of resizing under it.
            AndroidView(modifier = Modifier.fillMaxSize(), factory = { handle.view })

            // A cross-fade rather than a swap: the web view keeps painting underneath the
            // whole time, so the page is never revealed mid-layout. Dropped from composition
            // once transparent, so its shimmer stops animating.
            val skeletonAlpha by animateFloatAsState(
                targetValue = if (state.pageVisible) 0f else 1f,
                animationSpec = tween(SKELETON_FADE_MILLIS),
                label = "frak-sharing-skeleton-fade",
            )
            if (skeletonAlpha > 0f) {
                SharingSheetSkeleton(Modifier.graphicsLayer { alpha = skeletonAlpha })
            }

            SharingSheetGrabStrip(
                modifier = Modifier.align(Alignment.TopCenter),
                onDrag = { delta ->
                    scope.launch { dragOffset.snapTo((dragOffset.value + delta).coerceAtLeast(0f)) }
                },
                onDragStopped = { velocity ->
                    val height = sheetHeightPx.toFloat()
                    val flung = velocity > DISMISS_VELOCITY_PX_PER_SECOND
                    if (flung || dragOffset.value > height * DISMISS_FRACTION) {
                        // Off-screen first, then report: state.dismiss() drops this composable
                        // outright, so reporting first would cut the animation.
                        dragOffset.animateTo(height, tween(DISMISS_MILLIS))
                        state.dismiss()
                    } else {
                        dragOffset.animateTo(0f, spring())
                    }
                },
            )
        }
    }
}

/**
 * The sheet's only drag surface.
 *
 * A Compose hit target stacked above the `AndroidView`, so the web view never sees these
 * touches and there is nothing to arbitrate — the reason the sheet's own gesture is off. Much
 * taller than the pill it draws: the visible handle is a 4dp bar, and a 4dp target is exactly
 * what made this hard to grab.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SharingSheetGrabStrip(
    modifier: Modifier = Modifier,
    onDrag: (Float) -> Unit,
    onDragStopped: suspend (Float) -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(GRAB_STRIP_HEIGHT)
                .draggable(
                    orientation = Orientation.Vertical,
                    state = rememberDraggableState(onDelta = onDrag),
                    onDragStopped = { velocity -> onDragStopped(velocity) },
                ),
        contentAlignment = Alignment.Center,
    ) {
        // Over the page, not above it — scrolled content passing under a translucent pill is
        // ordinary for a sheet hosting a full-bleed surface. The page hides its own header in
        // native mode, so nothing tappable sits under this strip.
        BottomSheetDefaults.DragHandle()
    }
}

/** Fallback threshold: past this, skip the page and fire the native share sheet directly. */
private const val PAGE_LOAD_DEADLINE_MILLIS = 1_500L

/** Longest the skeleton may cover a page whose document hasn't even finished. Above the tier-3 deadline by design. */
private const val SKELETON_MAX_HOLD_MILLIS = 2_500L

/** Longest it may cover a finished document that produced no paint signal. */
private const val SKELETON_GRACE_MILLIS = 400L

private const val SKELETON_FADE_MILLIS = 180

/** Deliberately generous: the visible pill is 4dp tall and was the thing users kept missing. */
private val GRAB_STRIP_HEIGHT = 44.dp

/** Share of the sheet's height a drag must cross to dismiss on release. */
private const val DISMISS_FRACTION = 0.35f

/** A flick dismisses regardless of distance, in pixels per second. */
private const val DISMISS_VELOCITY_PX_PER_SECOND = 1_200f

private const val DISMISS_MILLIS = 180
