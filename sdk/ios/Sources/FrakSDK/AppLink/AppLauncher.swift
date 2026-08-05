import Foundation

// Platform seam for probing/opening URLs, so the client stays testable.
protocol AppLauncher: Sendable {
    func canOpen(_ url: String) async -> Bool
    func open(_ url: String) async -> Bool
}

#if canImport(UIKit)
    import UIKit

    // canOpen needs the wallet's scheme in LSApplicationQueriesSchemes or it answers false
    // for an installed app; open isn't gated by that list, so the client attempts it anyway.
    struct SystemAppLauncher: AppLauncher {
        // @MainActor because UIApplication is; async requirement lets the caller hop for free.
        @MainActor
        func canOpen(_ url: String) async -> Bool {
            guard let url = URL(string: url) else { return false }
            return UIApplication.shared.canOpenURL(url)
        }

        @MainActor
        func open(_ url: String) async -> Bool {
            guard let url = URL(string: url) else { return false }
            return await UIApplication.shared.open(url)
        }
    }
#else
    // No UIApplication on the host toolchain (swift test's second stage).
    struct SystemAppLauncher: AppLauncher {
        func canOpen(_ url: String) async -> Bool { false }
        func open(_ url: String) async -> Bool { false }
    }
#endif
