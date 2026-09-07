import StoreKit
import SwiftUI
import UIKit

/// The two ways iOS can invite an app install, side by side, against an editable item id.
///
/// They differ in where they attach — `SKOverlay` goes on the `UIWindowScene`, so a modal covers
/// it — and in how they fail: a non-app id makes the overlay do nothing at all, silently, while
/// the product page opens whatever the id really points at.
@MainActor
enum StoreInvite {
    /// Frak Wallet, `id.frak.wallet`. Listed in FR/GB/DE/ES/IT and not the US, so a lookup
    /// without a `country` reports it missing and a storefront-less URL 404s elsewhere.
    static let frakWalletId = "6759159306"

    private static var presenter: ProductPagePresenter?

    private static func foregroundScene() -> UIWindowScene? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
    }

    private static func topViewController() -> UIViewController? {
        guard var top = foregroundScene()?.keyWindow?.rootViewController else { return nil }
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }

    static func presentOverlay() -> String {
        guard let scene = foregroundScene() else { return "no foreground-active scene" }

        let configuration = SKOverlay.AppConfiguration(appIdentifier: frakWalletId, position: .bottom)
        SKOverlay(configuration: configuration).present(in: scene)

        // Reported because a bad id raises no error and `present(in:)` returns nothing, so
        // "nothing happened" is otherwise ambiguous between a covered overlay and a rejected id.
        if let covering = scene.keyWindow?.rootViewController?.presentedViewController {
            return "presented over the scene, with \(type(of: covering)) on top"
        }
        return "presented over the scene — if you see nothing, the id is not an app"
    }

    /// The overlay outlives the view that raised it: it belongs to the scene, not to whatever
    /// presented it, so dismissing a sheet leaves it on screen. Scene-wide, hence no instance.
    static func dismissOverlay() -> String {
        guard let scene = foregroundScene() else { return "no foreground-active scene" }
        SKOverlay.dismiss(in: scene)
        return "dismiss(in:) called"
    }

    static func presentProductPage(report: @escaping (String) -> Void) {
        guard let host = topViewController() else {
            report("no view controller to present from")
            return
        }
        let presenter = ProductPagePresenter()
        Self.presenter = presenter
        presenter.present(from: host, report: report)
    }
}

@MainActor
private final class ProductPagePresenter: NSObject, SKStoreProductViewControllerDelegate {
    private let controller = SKStoreProductViewController()
    private var report: ((String) -> Void)?

    func present(from host: UIViewController, report: @escaping (String) -> Void) {
        self.report = report
        controller.delegate = self
        // Loaded before presenting, not after: presenting first puts up a blank page that
        // never fills in when the load fails.
        controller.loadProduct(withParameters: [
            SKStoreProductParameterITunesItemIdentifier: NSNumber(value: Int(StoreInvite.frakWalletId) ?? 0)
        ]) { [weak self] loaded, error in
            // Not documented to arrive on the main thread, and only Sendable values may cross.
            let failure = error?.localizedDescription
            Task { @MainActor in self?.finishLoad(loaded, from: host, failure: failure) }
        }
    }

    private func finishLoad(_ loaded: Bool, from host: UIViewController, failure: String?) {
        guard loaded else {
            report?("load failed: \(failure ?? "unknown")")
            return
        }
        host.present(controller, animated: true)
        // A load succeeds for any iTunes item, not just apps — a book id lands in Books.
        report?("presented over \(type(of: host))")
    }

    nonisolated func productViewControllerDidFinish(_ viewController: SKStoreProductViewController) {
        Task { @MainActor [weak self] in self?.dismiss() }
    }

    private func dismiss() {
        controller.presentingViewController?.dismiss(animated: true)
        report?("dismissed")
    }
}

/// Run each presenter from here, then again from inside the sheet — the second run is the
/// condition the sharing sheet creates.
struct StoreInviteCard: View {
    @State private var status = "not run yet"
    @State private var showingSheet = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("App Store Invite Presenters")
                .font(.headline)
                .foregroundColor(FrakTheme.textPrimary)
            Text(
                "SKOverlay attaches to the window scene; SKStoreProductViewController is a modal. "
                    + "Both point at Frak Wallet."
            )
            .font(.caption)
            .foregroundColor(FrakTheme.textSecondary)

            StoreInviteButtons(status: $status)

            Text(status)
                .font(.caption)
                .foregroundColor(FrakTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: { showingSheet = true }) {
                HStack {
                    Image(systemName: "rectangle.portrait.bottomhalf.filled")
                    Text("Try both from inside a sheet")
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(FrakTheme.surfaceBackground)
                .foregroundColor(FrakTheme.textPrimary)
                .cornerRadius(8)
            }
        }
        .padding(12)
        .background(FrakTheme.surfaceBackground2)
        .cornerRadius(10)
        .sheet(isPresented: $showingSheet) {
            StoreInviteSheet(status: $status)
        }
    }
}

private struct StoreInviteSheet: View {
    @Binding var status: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Presenting from inside a sheet")
                .font(.headline)
                .foregroundColor(FrakTheme.textPrimary)
            Text("What the sharing sheet does. The product page should appear on top; the overlay should not.")
                .font(.caption)
                .foregroundColor(FrakTheme.textSecondary)

            StoreInviteButtons(status: $status)

            Text(status)
                .font(.caption)
                .foregroundColor(FrakTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FrakTheme.surfaceBackground)
    }
}

private struct StoreInviteButtons: View {
    @Binding var status: String

    var body: some View {
        VStack(spacing: 8) {
            Button(action: { status = StoreInvite.presentOverlay() }) {
                HStack {
                    Image(systemName: "rectangle.bottomthird.inset.filled")
                    Text("SKOverlay (scene)")
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(FrakTheme.surfacePrimary)
                .foregroundColor(FrakTheme.textOnAction)
                .cornerRadius(8)
            }

            Button(action: { status = StoreInvite.dismissOverlay() }) {
                HStack {
                    Image(systemName: "xmark.circle")
                    Text("Dismiss SKOverlay")
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(FrakTheme.surfaceBackground2)
                .foregroundColor(FrakTheme.textPrimary)
                .cornerRadius(8)
            }

            Button(action: { StoreInvite.presentProductPage() { status = $0 } }) {
                HStack {
                    Image(systemName: "app.badge")
                    Text("SKStoreProductViewController (modal)")
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(FrakTheme.success)
                .foregroundColor(FrakTheme.textOnAction)
                .cornerRadius(8)
            }
        }
    }
}
