package id.frak.example.android.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SecondaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.frak.example.android.DebugRow
import id.frak.example.android.HarnessEnvironment

/**
 * Everything an engineer needs and a tester may be asked to read out: the live stage, the wiring
 * the SDK reports, and the platform probes that only make sense to the SDK's own authors.
 */
@Composable
fun DebugTab(
    activeEnvironment: HarnessEnvironment,
    selectedEnvironment: HarnessEnvironment,
    onSelectEnvironment: (HarnessEnvironment) -> Unit,
    onRestartNow: () -> Unit,
    debugRows: List<DebugRow>,
    debugExport: String,
    isDebugRefreshing: Boolean,
    onRefreshDebugInfo: () -> Unit,
    onRunJavaInterop: () -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        item {
            EnvironmentCard(
                active = activeEnvironment,
                selected = selectedEnvironment,
                onSelect = onSelectEnvironment,
                onRestartNow = onRestartNow,
            )
        }
        item {
            SdkDebugCard(
                rows = debugRows,
                exportText = debugExport,
                isRefreshing = isDebugRefreshing,
                onRefresh = onRefreshDebugInfo,
            )
        }
        item {
            ProbesCard(onRunJavaInterop = onRunJavaInterop)
        }
    }
}

/**
 * Picks the stage the next launch initializes against. Never the running one — switching in place
 * would leave the sharing sheet's pooled web view on the previous stage's wallet origin.
 */
@Composable
private fun EnvironmentCard(
    active: HarnessEnvironment,
    selected: HarnessEnvironment,
    onSelect: (HarnessEnvironment) -> Unit,
    onRestartNow: () -> Unit,
) {
    HarnessCard(
        title = "Frak environment",
        subtitle = "Running on ${active.label} (${active.backendOrigin}).",
    ) {
        SecondaryTabRow(selectedTabIndex = HarnessEnvironment.entries.indexOf(selected)) {
            HarnessEnvironment.entries.forEach { environment ->
                Tab(
                    selected = environment == selected,
                    onClick = { onSelect(environment) },
                ) {
                    Text(environment.label, modifier = Modifier.padding(10.dp))
                }
            }
        }
        if (selected != active) {
            RestartBanner(target = selected, onRestartNow = onRestartNow)
        }
    }
}

/** The switch only takes effect on relaunch, and a caption was too quiet to be noticed. */
@Composable
private fun RestartBanner(
    target: HarnessEnvironment,
    onRestartNow: () -> Unit,
) {
    Surface(
        color = FrakTheme.error,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(10.dp),
        ) {
            Text(
                text = "Restart to run on ${target.label}",
                style = MaterialTheme.typography.labelLarge,
                color = FrakTheme.textOnAction,
            )
            Text(
                text = "The stage only changes when the app process starts again.",
                style = MaterialTheme.typography.bodySmall,
                color = FrakTheme.textOnAction,
            )
            ActionButton(
                label = "Restart now",
                tint = ActionTint.NEUTRAL,
                onClick = onRestartNow,
            )
        }
    }
}

/** Everything the SDK reports about this install, for checking the wiring on a real device. */
@Composable
private fun SdkDebugCard(
    rows: List<DebugRow>,
    exportText: String,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
) {
    val context = LocalContext.current
    HarnessCard(
        title = "SDK debug info",
        subtitle = "Read back from the live client — identity, merchant and origins.",
    ) {
        if (rows.isEmpty()) {
            Text(
                text = "Loading…",
                style = MaterialTheme.typography.bodySmall,
                color = FrakTheme.textSecondary,
            )
        }
        rows.forEach { row -> DebugRowLine(label = row.label, value = row.value) }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ActionButton(
                label = if (isRefreshing) "Refreshing…" else "Refresh",
                modifier = Modifier.weight(1f),
                enabled = !isRefreshing,
                onClick = onRefresh,
            )
            ActionButton(
                label = "Copy",
                modifier = Modifier.weight(1f),
                tint = ActionTint.NEUTRAL,
            ) { copyToClipboard(context, exportText) }
        }
    }
}

/**
 * SDK-author probes, collapsed: a tester never needs them, and an open card of them reads as part
 * of the merchant flow.
 */
@Composable
private fun ProbesCard(onRunJavaInterop: () -> Unit) {
    var isExpanded by remember { mutableStateOf(false) }
    HarnessCard(
        title = if (isExpanded) "Developer probes ▾" else "Developer probes ▸",
        modifier = Modifier.clickable { isExpanded = !isExpanded },
    ) {
        AnimatedVisibility(visible = isExpanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Runs the Java-facing *Async surface, which only a Java merchant would reach for.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FrakTheme.textSecondary,
                )
                ActionButton(
                    label = "Run Java interop probe",
                    tint = ActionTint.NEUTRAL,
                    onClick = onRunJavaInterop,
                )
            }
        }
    }
}
