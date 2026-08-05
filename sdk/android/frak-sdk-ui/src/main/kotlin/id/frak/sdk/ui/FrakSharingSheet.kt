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
 * The sharing sheet: the hosted `/sharing` page, edge to edge, filling the bottom of a window of
 * its own. The sheet is chrome only — a grab strip and a scrim. Share/Copy live in the page's own
 * footer and reach this sheet as page actions (see [SharingPageAction]). Even the rounded top
 * corners belong to the page now; see [SHEET_CORNER_RADIUS_DP].
 *
 * **Not a `ModalBottomSheet`, deliberately.** This composes inside a `ComponentDialog` that
 * [SharingHost] owns, and `ModalBottomSheet` would build a second Dialog with a second Window
 * inside that one: two scrims, two back-press dispatchers, two IME contracts, and two windows
 * competing for TalkBack's notion of the active window. It was also providing almost nothing —
 * every one of its capabilities was already switched off here (`sheetGesturesEnabled = false`,
 * `dragHandle = null`, `containerColor = Transparent`, `shape = RectangleShape`), leaving three
 * things, each replaced directly:
 *
 * | Was | Now |
 * |---|---|
 * | A Dialog and a Window | The host's `ComponentDialog` |
 * | The scrim | [drawBehind] on the root, keyed to the same offset as the sheet |
 * | Slide in / slide out | The [Animatable] below, which was already driving the drag |
 *
 * Two M3 bugs go with it, both of which `07-sharing-sheet-audit.md` closed as unfixable from
 * outside: the entry overshoot's `verticalScaleUp`/`verticalScaleDown` scaling the WebView's draw
 * functor, and `DraggableAnchorsNode.measure` placing without a layer so the show/hide animation
 * re-ran `WebView.layout()` every frame.
 *
 * @param exitSignal bumped by [SharingHost] to ask the sheet to animate out and then report. The
 *   sheet reports on its own once the animation lands, so the composition survives long enough to
 *   play it.
 * @param animateIn false when this composition is replacing one a configuration change destroyed.
 *   The sheet was already on screen before the rotation, so sliding it up again would announce an
 *   arrival that did not happen.
 * @param onExitStarted called the moment any of the four dismissal routes begins its animation.
 *   The animation runs for [DISMISS_MILLIS] before anything is reported, and that window is long
 *   enough to rotate in — at which point this composition and its `Animatable` die mid-flight and
 *   nothing would ever report. [SharingHost] holds the fact that an exit was asked for, so it can
 *   finish the session itself rather than putting the sheet back on screen.
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
        presentation.onPresented()
        // Deliberately nothing on dispose. [SharingHost] owns the session's teardown, and this
        // composition is destroyed by a configuration change as well as by a real dismissal — the
        // two are indistinguishable from in here, and disposing on the first would end a session
        // the host is about to re-attach to a new dialog. The host disposes from `finish` and from
        // `onOwnerCleared`, which between them cover every way a session can end.
        onDispose { }
    }

    /**
     * How far down the sheet sits, as a fraction of its own height: `1f` fully off-screen below,
     * `0f` at rest. Drives the entry, the drag and the exit.
     *
     * A fraction rather than pixels because the entry animation has to start before the sheet has
     * ever been measured — at the first frame there is no height to translate by yet, and
     * `graphicsLayer` reads the real one at draw time.
     */
    val offset = remember { Animatable(if (animateIn) 1f else 0f) }
    var sheetHeightPx by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        if (animateIn) offset.animateTo(0f, tween(ENTER_MILLIS))
    }

    // 0 is "no exit requested" — the host resets it to 0 between sessions, and a fresh
    // composition starts there too.
    LaunchedEffect(exitSignal) {
        if (exitSignal > 0) exit(offset, state, onExitStarted)
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                // Drawn rather than dimmed by the window: `FLAG_DIM_BEHIND` is constant for as
                // long as the window is up, so it would pop in and out while the sheet is still
                // sliding. Read in the draw phase, so a drag only redraws it.
                .drawBehind {
                    drawRect(
                        color = Color.Black,
                        alpha = SCRIM_ALPHA * (1f - offset.value).coerceIn(0f, 1f),
                    )
                },
    ) {
        // Tapping outside the sheet dismisses it. `setCanceledOnTouchOutside` cannot do this: the
        // window is full-screen, so every touch is inside it. No ripple and no semantics — the
        // dismiss affordance TalkBack offers is on the sheet itself, below.
        Box(
            modifier =
                Modifier
                    .matchParentSize()
                    .pointerInput(Unit) {
                        detectTapGestures { scope.launch { exit(offset, state, onExitStarted) } }
                    }.clearAndSetSemantics { },
        )

        // A fraction, not a fixed dp: the hosted page's first screenful (reward card, product
        // cards, stepper, FAQ) needs the whole height, and there's no native chrome left to
        // subtract from it.
        Box(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .fillMaxHeight(clampSharingHeightFraction(heightFraction))
                    .onSizeChanged { sheetHeightPx = it.height }
                    // `graphicsLayer`, not `Modifier.offset {}`: the offset lambda is read during
                    // the *placement* phase, so every frame of a drag invalidates placement and
                    // re-runs `AndroidViewHolder`'s `layoutAccordingTo` — i.e. a real
                    // `WebView.layout()` per frame. `translationY` is read in the draw phase and
                    // only updates the layer's transform matrix, so the layout phase is skipped
                    // entirely. Compose hit-testing follows the layer transform, so the grab
                    // strip stays grabbable where it is drawn.
                    .graphicsLayer { translationY = offset.value * size.height }
                    // Applied *after* `graphicsLayer`, so it insets this box's children rather
                    // than the box, and that ordering is the whole trick. Outside the layer the
                    // padding would shrink the height `translationY` multiplies, and a full-offset
                    // exit would leave a nav-bar-tall sliver of the page parked over the nav bar
                    // instead of clearing the screen.
                    //
                    // Needed at all because the sheet no longer composes inside the merchant's
                    // window. That one fits system windows, so its content area already stopped
                    // above the nav bar; this one is a dialog with `setDecorFitsSystemWindows(false)`
                    // and spans the whole display, so without this the page's last ~48dp — its CTA
                    // row — sits behind the nav bar. Not clipped, occluded.
                    //
                    // `navigationBars` rather than a bottom-only inset: the bar is on the side in
                    // landscape, and this pads whichever edge it actually occupies. No `imePadding`
                    // to go with it — the hosted page has no text input today, and adding an untested
                    // resize path for a keyboard that never opens would be speculation.
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    // No string of our own: this module ships no resources, and TalkBack localises
                    // its own label for a dismiss action. That is the whole accessibility contract
                    // `ModalBottomSheet` used to supply here.
                    .semantics {
                        dismiss {
                            scope.launch { exit(offset, state, onExitStarted) }
                            true
                        }
                    },
        ) {
            // Composed from the first frame rather than waiting on the session: a pooled view
            // is already warm, and attaching and laying it out at the real size now means the
            // session's own load lands into a settled viewport instead of resizing under it.
            AndroidView(modifier = Modifier.fillMaxSize(), factory = { handle.view })

            // The renderer died after the page had painted. The sheet stays up on purpose — see
            // SharingSheetState.onPageUnavailable — but the web view is transparent and the sheet
            // paints no surface of its own, so "stays up" would otherwise mean a see-through hole
            // with a grab pill floating in it. Opaque and correctly rounded, with no shimmer:
            // nothing is loading, there is just nothing left to show.
            if (state.contentLost) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = SheetCornerShape,
                    color = BottomSheetDefaults.ContainerColor,
                ) {}
            }

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
                    val height = sheetHeightPx.toFloat()
                    if (height > 0f) {
                        scope.launch { offset.snapTo((offset.value + delta / height).coerceAtLeast(0f)) }
                    }
                },
                onDragStopped = { velocity ->
                    // Guarded like onDrag: an unmeasured sheet has no distance to compare a fling
                    // against, and dismissing one is not something a user can have asked for.
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
 * Animates the sheet off-screen, then reports.
 *
 * That order matters: `state.dismiss()` reaches [SharingHost.finish], which dismisses the dialog
 * and tears this composition down outright — reporting first would cut the animation mid-flight.
 *
 * A top-level function rather than a local one inside the composable, so nothing about it depends
 * on how the Compose compiler treats declarations nested in a `@Composable`.
 */
private suspend fun exit(
    offset: Animatable<Float, AnimationVector1D>,
    state: SharingSheetState,
    onExitStarted: () -> Unit,
) {
    // Before the animation, not after: the whole point is that the host knows an exit is in
    // progress while it is still in progress.
    onExitStarted()
    offset.animateTo(1f, tween(DISMISS_MILLIS))
    state.dismiss()
}

/**
 * The sheet's only drag surface.
 *
 * A Compose hit target stacked above the `AndroidView`, so the web view never sees these
 * touches and there is nothing to arbitrate — the page gets every gesture that lands on it, the
 * grab strip gets the rest. Much taller than the pill it draws: the visible handle is a 4dp bar,
 * and a 4dp target is exactly what made this hard to grab.
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

/** Slower than the exit on purpose: entering wants to read as arriving, leaving as getting out of the way. */
private const val ENTER_MILLIS = 250

/** M3's own scrim opacity, which this replaces. */
private const val SCRIM_ALPHA = 0.32f
