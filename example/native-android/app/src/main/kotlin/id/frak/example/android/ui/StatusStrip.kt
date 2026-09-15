package id.frak.example.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.frak.example.android.HarnessEnvironment
import id.frak.example.android.SdkState

/**
 * Always-visible health line: which stage is live, whether the SDK reached it, whether the wallet
 * is installed, and which build this is.
 */
@Composable
fun StatusStrip(
    environment: HarnessEnvironment,
    sdkState: SdkState,
    walletInstalled: Boolean?,
    buildLabel: String,
    sdkVersion: String,
) {
    val environmentColor =
        if (environment == HarnessEnvironment.PRODUCTION) FrakTheme.error else FrakTheme.surfacePrimary
    val sdkColor =
        when (sdkState) {
            SdkState.Checking -> FrakTheme.textSecondary
            SdkState.Connected -> FrakTheme.success
            is SdkState.Failed -> FrakTheme.error
        }
    val walletLabel =
        when (walletInstalled) {
            true -> "Wallet installed"
            false -> "No wallet app"
            else -> "Wallet ?"
        }

    Column(
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusPill(text = environment.label, color = environmentColor)
            StatusPill(text = sdkState.label, color = sdkColor)
            StatusPill(
                text = walletLabel,
                color = if (walletInstalled == true) FrakTheme.success else FrakTheme.surfaceDisabled,
            )
        }
        Text(
            text = "App $buildLabel · SDK $sdkVersion",
            fontFamily = FontFamily.Monospace,
            fontSize = 10.sp,
            color = FrakTheme.textSecondary,
        )
    }
}
