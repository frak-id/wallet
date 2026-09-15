import SwiftUI
import UIKit

/// Visual weight of an action, mapped onto the semantic tokens in `FrakTokens`.
enum ActionTint {
    case primary, neutral, success

    var background: Color {
        switch self {
        case .primary: return FrakTheme.surfacePrimary
        case .neutral: return FrakTheme.surfaceMuted
        case .success: return FrakTheme.success
        }
    }

    var foreground: Color {
        switch self {
        case .primary, .success: return FrakTheme.textOnAction
        case .neutral: return FrakTheme.textPrimary
        }
    }
}

struct ActionButton: View {
    let label: String
    var systemImage: String?
    var tint: ActionTint = .primary
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(label)
            }
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(isDisabled ? FrakTheme.surfaceDisabled : tint.background)
            .foregroundColor(isDisabled ? FrakTheme.textSecondary : tint.foreground)
            .cornerRadius(8)
        }
        .disabled(isDisabled)
    }
}

/// Every section of every tab is one of these, so the tabs stay readable as a list of sections.
struct HarnessCard<Content: View>: View {
    let title: String
    var subtitle: String?
    var tinted = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(FrakTheme.textPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(FrakTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tinted ? FrakTheme.surfaceSecondary : FrakTheme.surfaceBackground2)
        .cornerRadius(10)
    }
}

struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(FrakTheme.textOnAction)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color)
            .cornerRadius(20)
    }
}

/// `ShareLink` is iOS 16; the harness deploys to 15, so the share sheet is bridged by hand.
struct ActivityView: UIViewControllerRepresentable {
    let text: String

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [text], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

func copyToClipboard(_ text: String) {
    UIPasteboard.general.string = text
}
