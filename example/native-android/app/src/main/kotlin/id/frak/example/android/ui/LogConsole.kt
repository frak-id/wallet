package id.frak.example.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import id.frak.example.android.LogEntry
import id.frak.example.android.LogType

/**
 * The event log, and the only thing a tester has to hand back when something looks wrong — hence
 * copy, share and clear sitting on it rather than in the debug tab.
 */
@Composable
fun LogConsole(
    logs: List<LogEntry>,
    exportText: String,
    onClear: () -> Unit,
) {
    val context = LocalContext.current
    var isExpanded by remember { mutableStateOf(false) }

    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = "Event log (${logs.size})",
                style = MaterialTheme.typography.labelMedium,
                color = FrakTheme.textPrimary,
                modifier = Modifier.weight(1f),
            )
            LogAction(label = "Copy") { copyToClipboard(context, exportText) }
            LogAction(label = "Share") { shareText(context, exportText) }
            LogAction(label = "Clear", onClick = onClear)
            LogAction(label = "Expand") { isExpanded = true }
        }
        Card(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .border(1.dp, FrakTheme.borderDefault, RoundedCornerShape(8.dp)),
        ) {
            LogList(logs = logs, modifier = Modifier.fillMaxSize())
        }
    }

    if (isExpanded) {
        ExpandedLog(
            logs = logs,
            exportText = exportText,
            onClear = onClear,
            onDismiss = { isExpanded = false },
        )
    }
}

@Composable
private fun ExpandedLog(
    logs: List<LogEntry>,
    exportText: String,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(color = FrakTheme.surfaceBackground, modifier = Modifier.fillMaxSize()) {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Event log (${logs.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = FrakTheme.textPrimary,
                        modifier = Modifier.weight(1f),
                    )
                    LogAction(label = "Close", onClick = onDismiss)
                }
                LogList(logs = logs, modifier = Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionButton(
                        label = "Copy",
                        modifier = Modifier.weight(1f),
                        tint = ActionTint.NEUTRAL,
                    ) { copyToClipboard(context, exportText) }
                    ActionButton(
                        label = "Share",
                        modifier = Modifier.weight(1f),
                        tint = ActionTint.NEUTRAL,
                    ) { shareText(context, exportText) }
                    ActionButton(
                        label = "Clear",
                        modifier = Modifier.weight(1f),
                        tint = ActionTint.NEUTRAL,
                        onClick = onClear,
                    )
                }
            }
        }
    }
}

@Composable
private fun LogList(
    logs: List<LogEntry>,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier =
            modifier
                .background(FrakTheme.consoleSurface)
                .padding(8.dp),
    ) {
        items(logs) { entry ->
            val color =
                when (entry.type) {
                    LogType.INFO -> FrakTheme.consoleInfo
                    LogType.SUCCESS -> FrakTheme.consoleSuccess
                    LogType.ERROR -> FrakTheme.consoleError
                }
            Text(
                text = entry.exportLine,
                color = color,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }
    }
}

@Composable
private fun LogAction(
    label: String,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick, contentPadding = PaddingValues(8.dp)) {
        Text(text = label, fontSize = 12.sp, color = FrakTheme.textSecondary)
    }
}
