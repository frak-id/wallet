import SwiftUI

/// The event log, and the only thing a tester has to hand back when something looks wrong — hence
/// copy, share and clear sitting on it rather than in the debug tab.
struct LogConsole: View {
    let logs: [LogEntry]
    let exportText: String
    let onClear: () -> Void

    @State private var isExpanded = false
    @State private var isSharing = false
    @State private var justCopied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 12) {
                Text(justCopied ? "Copied to clipboard" : "Event log (\(logs.count))")
                    .font(.caption)
                    .bold()
                    .foregroundColor(justCopied ? FrakTheme.success : FrakTheme.textPrimary)
                Spacer()
                LogAction(systemImage: "doc.on.doc", label: "Copy log", action: copy)
                LogAction(systemImage: "square.and.arrow.up", label: "Share log") { isSharing = true }
                LogAction(systemImage: "trash", label: "Clear log", action: onClear)
                LogAction(
                    systemImage: "arrow.up.left.and.arrow.down.right",
                    label: "Expand log"
                ) {
                    isExpanded = true
                }
            }

            LogList(logs: logs)
                .frame(height: 120)
                .background(FrakTheme.consoleSurface)
                .cornerRadius(8)
        }
        .sheet(isPresented: $isSharing) {
            ActivityView(text: exportText)
        }
        .sheet(isPresented: $isExpanded) {
            ExpandedLog(logs: logs, exportText: exportText, onClear: onClear)
        }
    }

    private func copy() {
        copyToClipboard(exportText)
        justCopied = true
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            justCopied = false
        }
    }
}

private struct ExpandedLog: View {
    let logs: [LogEntry]
    let exportText: String
    let onClear: () -> Void
    @Environment(\.presentationMode) private var presentationMode

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Event log (\(logs.count))")
                    .font(.headline)
                    .foregroundColor(FrakTheme.textPrimary)
                Spacer()
                Button("Close") { presentationMode.wrappedValue.dismiss() }
            }
            LogList(logs: logs)
                .background(FrakTheme.consoleSurface)
                .cornerRadius(8)
            HStack(spacing: 8) {
                ActionButton(label: "Copy", systemImage: "doc.on.doc", tint: .neutral) {
                    copyToClipboard(exportText)
                }
                ActionButton(label: "Clear", systemImage: "trash", tint: .neutral, action: onClear)
            }
        }
        .padding(16)
        .background(FrakTheme.surfaceBackground)
    }
}

private struct LogList: View {
    let logs: [LogEntry]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(logs) { entry in
                    HStack(alignment: .top, spacing: 4) {
                        Text("[\(entry.timestamp)]")
                            .foregroundColor(FrakTheme.consoleTimestamp)
                        Text(entry.message)
                            .foregroundColor(color(for: entry.type))
                    }
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(8)
        }
    }

    private func color(for type: LogEntry.LogType) -> Color {
        switch type {
        case .info: return FrakTheme.consoleInfo
        case .success: return FrakTheme.consoleSuccess
        case .error: return FrakTheme.consoleError
        }
    }
}

private struct LogAction: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 13))
                .foregroundColor(FrakTheme.textSecondary)
        }
        .accessibilityLabel(label)
    }
}
