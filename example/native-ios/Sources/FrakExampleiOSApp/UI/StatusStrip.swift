import SwiftUI

/// Always-visible health line: which stage is live, whether the SDK reached it, whether the
/// wallet is installed, and which build this is.
struct StatusStrip: View {
    let environment: HarnessEnvironment
    let sdkState: SdkState
    let walletInstalled: Bool?
    let sdkVersion: String

    private var environmentColor: Color {
        environment == .production ? FrakTheme.error : FrakTheme.surfacePrimary
    }

    private var sdkColor: Color {
        switch sdkState {
        case .checking: return FrakTheme.textSecondary
        case .connected: return FrakTheme.success
        case .failed: return FrakTheme.error
        }
    }

    private var walletLabel: String {
        switch walletInstalled {
        case true: return "Wallet installed"
        case false: return "No wallet app"
        default: return "Wallet ?"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                StatusPill(text: environment.label, color: environmentColor)
                StatusPill(text: sdkState.label, color: sdkColor)
                StatusPill(
                    text: walletLabel,
                    color: walletInstalled == true ? FrakTheme.success : FrakTheme.surfaceDisabled
                )
                Spacer()
            }
            Text("App \(harnessBuildLabel) · SDK \(sdkVersion)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(FrakTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
