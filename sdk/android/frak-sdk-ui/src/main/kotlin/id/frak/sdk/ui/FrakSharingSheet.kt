package id.frak.sdk.ui

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import id.frak.sdk.sharing.SharingRequest
import java.util.UUID

/**
 * The sharing sheet: native chrome around the hosted `/sharing` page.
 *
 * The split is deliberate (02 §1.3). What the user can feel is native — the
 * sheet animates in immediately, and the footer opens the real OS share sheet
 * with their own apps and contacts, which a web page cannot reach. The reward
 * card, product cards and FAQ come from the page that already serves three
 * other consumers and is iterated on continuously; forking it natively would
 * gate every copy change on a merchant's app-store release cycle (02 §6).
 *
 * Presented through [rememberFrakSharingLauncher] rather than directly, so
 * re-entrancy and result aggregation have one owner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FrakSharingSheet(
    request: SharingRequest,
    onFinished: (SharingResult) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessionId = remember { UUID.randomUUID().toString() }
    val copiedMessage = stringResource(R.string.frak_sharing_copied)

    val state =
        remember {
            SharingSheetState(
                scope = scope,
                context = context,
                sessionId = sessionId,
                onFinished = onFinished,
                onCopyConfirmed = {
                    Toast.makeText(context, copiedMessage, Toast.LENGTH_SHORT).show()
                },
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

    // 02 §7's latency gate, keyed on `request`/`sessionId` (constant for this
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
    ) {
        val session = state.session
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = stringResource(R.string.frak_sharing_title),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            Box(
                modifier = Modifier.fillMaxWidth().height(PAGE_HEIGHT),
                contentAlignment = Alignment.Center,
            ) {
                if (session == null) {
                    // The sheet is already on screen and animating; the page
                    // loads into it rather than delaying it.
                    CircularProgressIndicator()
                } else {
                    AndroidView(
                        modifier = Modifier.fillMaxWidth().height(PAGE_HEIGHT),
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
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(
                    enabled = session != null,
                    onClick = state::copy,
                    modifier = Modifier.weight(1f),
                ) { Text(stringResource(R.string.frak_sharing_copy)) }

                Button(
                    enabled = session != null,
                    onClick = state::share,
                    modifier = Modifier.weight(1f),
                ) { Text(stringResource(R.string.frak_sharing_share)) }
            }
        }
    }
}

/** Height of the hosted page inside the sheet. */
private val PAGE_HEIGHT = 480.dp

/**
 * 02 §7's fallback threshold: "> 1.5s → skip the page, fire the native share
 * sheet directly". Taken as written rather than the p95 target doubled — the
 * previous 2s here was that doubling, but it was also timed from the wrong
 * point (see `awaitLoadDeadline`'s use above), so there is no longer a reason
 * to pad it independently of the plan's own number.
 */
private const val PAGE_LOAD_DEADLINE_MILLIS = 1_500L
