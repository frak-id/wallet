import SwiftUI

/// Everything an engineer needs and a tester may be asked to read out: which stage is live and the
/// wiring the SDK reports back.
struct DebugTab: View {
    @Binding var selectedEnvironment: HarnessEnvironment
    let onSelectEnvironment: (HarnessEnvironment) -> Void
    let debugRows: [DebugRow]
    let debugExport: String
    let isDebugRefreshing: Bool
    let onRefreshDebugInfo: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                EnvironmentCard(
                    selected: $selectedEnvironment,
                    onSelect: onSelectEnvironment
                )
                SdkDebugCard(
                    rows: debugRows,
                    exportText: debugExport,
                    isRefreshing: isDebugRefreshing,
                    onRefresh: onRefreshDebugInfo
                )
            }
        }
    }
}

/// Picks the stage the next launch initializes against. Never the running one — switching in place
/// would leave the sharing sheet's pooled web view on the previous stage's wallet origin.
private struct EnvironmentCard: View {
    @Binding var selected: HarnessEnvironment
    let onSelect: (HarnessEnvironment) -> Void

    /// A derived binding, not `.onChange`: the zero-argument overload is iOS 17 and this app
    /// deploys to 15.
    private var selection: Binding<HarnessEnvironment> {
        Binding(
            get: { selected },
            set: { environment in
                selected = environment
                onSelect(environment)
            }
        )
    }

    var body: some View {
        HarnessCard(
            title: "Frak environment",
            subtitle: "Running on \(activeEnvironment.label) (\(activeEnvironment.backendOrigin))."
        ) {
            Picker("Environment", selection: selection) {
                ForEach(HarnessEnvironment.allCases) { environment in
                    Text(environment.label).tag(environment)
                }
            }
            .pickerStyle(SegmentedPickerStyle())

            if selected != activeEnvironment {
                RestartBanner(target: selected)
            }
        }
    }
}

/// The switch only takes effect on relaunch, and a caption was too quiet to be noticed.
private struct RestartBanner: View {
    let target: HarnessEnvironment

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            VStack(alignment: .leading, spacing: 2) {
                Text("Close and reopen the app")
                    .font(.caption)
                    .bold()
                Text("Swipe the app away from the app switcher, then launch it again to run on \(target.label).")
                    .font(.caption)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .foregroundColor(FrakTheme.textOnAction)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(FrakTheme.error)
        .cornerRadius(8)
    }
}

/// Everything the SDK reports about this install, for checking the wiring on a real device.
private struct SdkDebugCard: View {
    let rows: [DebugRow]
    let exportText: String
    let isRefreshing: Bool
    let onRefresh: () -> Void

    var body: some View {
        HarnessCard(
            title: "SDK debug info",
            subtitle: "Read back from the live client — identity, merchant and origins."
        ) {
            if rows.isEmpty {
                Text("Loading…")
                    .font(.caption)
                    .foregroundColor(FrakTheme.textSecondary)
            }
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 4) {
                    Text("\(row.label):")
                        .foregroundColor(FrakTheme.textSecondary)
                    Text(row.value)
                        .foregroundColor(FrakTheme.textPrimary)
                        .textSelection(.enabled)
                }
                .font(.system(size: 11, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 8) {
                ActionButton(
                    label: isRefreshing ? "Refreshing…" : "Refresh",
                    systemImage: "arrow.clockwise",
                    isDisabled: isRefreshing,
                    action: onRefresh
                )
                ActionButton(label: "Copy", systemImage: "doc.on.doc", tint: .neutral) {
                    copyToClipboard(exportText)
                }
            }
        }
    }
}
