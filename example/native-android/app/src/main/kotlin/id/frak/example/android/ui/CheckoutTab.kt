package id.frak.example.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.frak.example.android.SAMPLE_ORDER_TOTAL_CENTS
import id.frak.example.android.formatCents

/** The two events a merchant reports back to Frak, each behind one button. */
@Composable
fun CheckoutTab(
    currencyCode: String,
    onOrderCompleted: () -> Unit,
    onSimulateDeepLink: () -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        item {
            HarnessCard(
                title = "Complete a test order",
                subtitle =
                    "Pretends the shopper just paid " +
                        "${formatCents(SAMPLE_ORDER_TOTAL_CENTS, currencyCode)} and reports it to Frak. " +
                        "Any reward earned lands on the wallet a few moments later.",
            ) {
                ActionButton(
                    label = "Complete order",
                    tint = ActionTint.SUCCESS,
                    onClick = onOrderCompleted,
                )
            }
        }
        item {
            HarnessCard(
                title = "Arrive from a shared link",
                subtitle =
                    "Pretends the app was opened from a friend's referral link, so the next order " +
                        "is credited to them. Watch the event log for the result.",
            ) {
                ActionButton(label = "Simulate a referral link", onClick = onSimulateDeepLink)
            }
        }
        item {
            HarnessCard(
                title = "Test the real link instead",
                subtitle =
                    "Opening a link ending in ?fCtx=… from another app exercises the same path for " +
                        "real. The simulator above skips Android's own intent routing.",
            )
        }
    }
}
