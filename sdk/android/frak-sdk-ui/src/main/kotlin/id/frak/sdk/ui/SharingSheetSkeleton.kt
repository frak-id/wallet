package id.frak.sdk.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * What the sheet shows until the hosted page has actually painted.
 *
 * A silhouette rather than a spinner, and opaque rather than translucent, because it is stacked
 * *over* the web view for the whole load: a WebView paints white before it has content, and the
 * old spinner-then-swap sequence showed that white rectangle for the entire page load. Nothing
 * here is measured against the real page — a rough shape that fades out reads as content
 * arriving, where an exact one that lands a few pixels off reads as a jump.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
internal fun SharingSheetSkeleton(modifier: Modifier = Modifier) {
    val shimmer = rememberInfiniteTransition(label = "frak-sharing-skeleton")
    val alpha by shimmer.animateFloat(
        initialValue = MIN_ALPHA,
        targetValue = MAX_ALPHA,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = PULSE_MILLIS),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "frak-sharing-skeleton-alpha",
    )

    Surface(modifier = modifier.fillMaxSize(), color = BottomSheetDefaults.ContainerColor) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    // Top inset clears the grab strip the sheet draws over this.
                    .padding(start = 20.dp, end = 20.dp, top = 36.dp, bottom = 20.dp)
                    .alpha(alpha),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Merchant row: logo, name.
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Block(width = Modifier.size(28.dp), height = 28.dp, shape = CircleShape)
                Block(width = Modifier.weight(0.5f), height = 28.dp)
            }

            // The reward headline, the page's largest element.
            Block(width = Modifier.fillMaxWidth(), height = 92.dp, shape = RoundedCornerShape(16.dp))

            // Product cards.
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Block(width = Modifier.weight(1f), height = 108.dp, shape = RoundedCornerShape(12.dp))
                Block(width = Modifier.weight(1f), height = 108.dp, shape = RoundedCornerShape(12.dp))
            }

            // The three-step explainer.
            repeat(STEP_COUNT) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Block(width = Modifier.size(20.dp), height = 20.dp, shape = CircleShape)
                    Block(width = Modifier.weight(1f), height = 20.dp)
                }
            }

            Spacer(Modifier.weight(1f))

            // Share / Copy footer.
            Block(width = Modifier.fillMaxWidth(), height = 48.dp, shape = RoundedCornerShape(24.dp))
        }
    }
}

@Composable
private fun Block(
    width: Modifier,
    height: Dp,
    shape: Shape = RoundedCornerShape(8.dp),
) {
    Spacer(
        modifier =
            width
                .height(height)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
    )
}

private const val MIN_ALPHA = 0.45f
private const val MAX_ALPHA = 0.85f
private const val PULSE_MILLIS = 700
private const val STEP_COUNT = 3
