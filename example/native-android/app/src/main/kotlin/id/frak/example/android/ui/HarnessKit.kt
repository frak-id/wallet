package id.frak.example.android.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Visual weight of an action, mapped onto the semantic tokens in [FrakTheme]. */
enum class ActionTint(
    val background: Color,
    val foreground: Color,
) {
    PRIMARY(FrakTheme.surfacePrimary, FrakTheme.textOnAction),
    NEUTRAL(FrakTheme.surfaceMuted, FrakTheme.textPrimary),
    SUCCESS(FrakTheme.success, FrakTheme.textOnAction),
}

@Composable
fun ActionButton(
    label: String,
    modifier: Modifier = Modifier,
    tint: ActionTint = ActionTint.PRIMARY,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = tint.background,
                contentColor = tint.foreground,
                disabledContainerColor = FrakTheme.surfaceDisabled,
                disabledContentColor = FrakTheme.textSecondary,
            ),
        modifier = modifier.fillMaxWidth(),
    ) {
        Text(label)
    }
}

/** Every section of every tab is one of these, so the tabs stay readable as a list of sections. */
@Composable
fun HarnessCard(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    tinted: Boolean = false,
    content: @Composable () -> Unit = {},
) {
    Card(
        colors =
            CardDefaults.cardColors(
                containerColor = if (tinted) FrakTheme.surfaceSecondary else FrakTheme.surfaceBackground2,
            ),
        modifier = modifier.fillMaxWidth(),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = FrakTheme.textPrimary,
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = FrakTheme.textSecondary,
                )
            }
            content()
        }
    }
}

@Composable
fun StatusPill(
    text: String,
    color: Color,
) {
    Surface(
        color = color,
        shape = RoundedCornerShape(20.dp),
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            color = FrakTheme.textOnAction,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
fun DebugRowLine(
    label: String,
    value: String,
) {
    Row(modifier = Modifier.padding(vertical = 2.dp)) {
        Text(
            text = "$label: ",
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = FrakTheme.textSecondary,
        )
        Text(
            text = value,
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            color = FrakTheme.textPrimary,
        )
    }
}

fun copyToClipboard(
    context: Context,
    text: String,
) {
    val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return
    clipboard.setPrimaryClip(ClipData.newPlainText("Frak harness", text))
}

fun shareText(
    context: Context,
    text: String,
) {
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
    context.startActivity(Intent.createChooser(intent, "Share Frak harness log"))
}
