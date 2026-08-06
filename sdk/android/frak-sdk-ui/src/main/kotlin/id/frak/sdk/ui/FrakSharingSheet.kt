package id.frak.sdk.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.dismiss
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The sharing sheet: the hosted `/sharing` page filling the bottom of the dialog [SharingHost]
 * owns. The sheet is chrome only — a grab strip and a scrim.
 *
 * @param exitSignal bumped by [SharingHost] to ask the sheet to animate out and then report.
 * @param animateIn false when this composition replaces one a configuration change destroyed.
 * @param onExitStarted called when a dismissal begins, so the host can finish the session even if
 *   this composition dies mid-animation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FrakSharingSheet(
    presentation: SharingPresentation,
    heightFraction: Float,
    exitSignal: Int,
    animateIn: Boolean,
    onExitStarted: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val state = presentation.state
    val handle = presentation.handle

    LaunchedEffect(state.failure) {
        state.failure?.let(state::fail)
    }

    // Bounds how long the skeleton may cover the page when no paint signal arrives.
    LaunchedEffect(state.pageLoaded) {
        delay(if (state.pageLoaded) SKELETON_GRACE_MILLIS else SKELETON_MAX_HOLD_MILLIS)
        state.onPageVisible()
    }

    DisposableEffect(presentation) {
        presentation.onPresented()
        // Nothing on dispose: [SharingHost] owns teardown, and a configuration change is
        // indistinguishable from a real dismissal in here.
        onDispose { }
    }

    /**
     * How far down the sheet sits, as a fraction of its own height: `1f` fully off-screen below,
     * `0f` at rest. A fraction rather than pixels because the entry starts before the sheet has
     * ever been measured.
     */
    val offset = remember { Animatable(if (animateIn) 1f else 0f) }
    var sheetHeightPx by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        if (animateIn) offset.animateTo(0f, tween(ENTER_MILLIS))
    }

    // 0 is "no exit requested".
    LaunchedEffect(exitSignal) {
        if (exitSignal > 0) exit(offset, state, onExitStarted)
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                // Drawn rather than dimmed by the window: `FLAG_DIM_BEHIND` is constant for as
                // long as the window is up, so it would pop in while the sheet is still sliding.
                .drawBehind {
                    drawRect(
                        color = Color.Black,
                        alpha = SCRIM_ALPHA * (1f - offset.value).coerceIn(0f, 1f),
                    )
                },
    ) {
        // Tapping outside the sheet dismisses it. `setCanceledOnTouchOutside` cannot do this: the
        // window is full-screen, so every touch is inside it.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .pointerInput(Unit) {
                        detectTapGestures { scope.launch { exit(offset, state, onExitStarted) } }
                    }.clearAndSetSemantics { },
        )

        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .fillMaxHeight(clampSharingHeightFraction(heightFraction))
                    .onSizeChanged { sheetHeightPx = it.height }
                    // `graphicsLayer`, not `Modifier.offset {}`: the offset lambda runs in the
                    // placement phase, which would re-run `WebView.layout()` every drag frame.
                    .graphicsLayer { translationY = offset.value * size.height }
                    // Applied after `graphicsLayer` so it insets the children, not the box —
                    // otherwise a full-offset exit leaves a sliver parked over the nav bar. The
                    // dialog spans the display, so without this the page's CTA row is occluded.
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    // No string of our own: this module ships no resources, and TalkBack localises
                    // its own dismiss label.
                    .semantics {
                        dismiss {
                            scope.launch { exit(offset, state, onExitStarted) }
                            true
                        }
                    },
        ) {
            // Composed from the first frame: the pooled view is already warm, so the session's
            // load lands into a settled viewport instead of resizing under it.
            AndroidView(modifier = Modifier.fillMaxSize(), factory = { handle.view })

            // Renderer died after the page painted. The sheet stays up (see
            // SharingSheetState.onPageUnavailable), so paint an opaque surface in place of the
            // now-transparent web view.
            if (state.contentLost) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = SheetCornerShape,
                    color = BottomSheetDefaults.ContainerColor,
                ) {}
            }

            // A cross-fade rather than a swap, so the page is never revealed mid-layout. Dropped
            // from composition once transparent, so its shimmer stops animating.
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
                    val height = sheetHeightPx.toFloat()
                    if (height > 0f) {
                        scope.launch { offset.snapTo((offset.value + delta / height).coerceAtLeast(0f)) }
                    }
                },
                onDragStopped = { velocity ->
                    // Guarded like onDrag: an unmeasured sheet has no distance to compare against.
                    val flung = sheetHeightPx > 0 && velocity > DISMISS_VELOCITY_PX_PER_SECOND
                    if (flung || offset.value > DISMISS_FRACTION) {
                        exit(offset, state, onExitStarted)
                    } else {
                        offset.animateTo(0f, spring())
                    }
                },
            )
        }
    }
}

/**
 * Animates the sheet off-screen, then reports. That order matters: `state.dismiss()` tears this
 * composition down, so reporting first would cut the animation mid-flight.
 */
private suspend fun exit(
    offset: Animatable<Float, AnimationVector1D>,
    state: SharingSheetState,
    onExitStarted: () -> Unit,
) {
    // Before the animation, so the host knows an exit is in progress while it still is.
    onExitStarted()
    offset.animateTo(1f, tween(DISMISS_MILLIS))
    state.dismiss()
}

/**
 * The sheet's only drag surface: a Compose hit target stacked above the `AndroidView`, so the web
 * view never sees these touches. Much taller than the 4dp pill it draws.
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
        BottomSheetDefaults.DragHandle()
    }
}

/** Longest the skeleton may cover a page whose document hasn't even finished. */
private const val SKELETON_MAX_HOLD_MILLIS = 2_500L

/** Longest it may cover a finished document that produced no paint signal. */
private const val SKELETON_GRACE_MILLIS = 400L

private const val SKELETON_FADE_MILLIS = 180

/** Deliberately generous: the visible pill is only 4dp tall. */
private val GRAB_STRIP_HEIGHT = 44.dp

/** Share of the sheet's height a drag must cross to dismiss on release. */
private const val DISMISS_FRACTION = 0.35f

/** A flick dismisses regardless of distance, in pixels per second. */
private const val DISMISS_VELOCITY_PX_PER_SECOND = 1_200f

private const val DISMISS_MILLIS = 180

private const val ENTER_MILLIS = 250

/** M3's own scrim opacity, which this replaces. */
private const val SCRIM_ALPHA = 0.32f
