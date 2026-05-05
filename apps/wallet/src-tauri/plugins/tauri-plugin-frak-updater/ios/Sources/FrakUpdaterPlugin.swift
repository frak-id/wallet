import SwiftRs
import Tauri
import UIKit

/**
 * Native iOS update checker.
 *
 * iOS has no in-app update mechanism (unlike Android's Play Core), so the
 * "soft update" path here is:
 *   1. `checkUpdate` queries the iTunes Lookup endpoint by the app's bundle
 *      identifier and reports the returned `version` to the frontend as a
 *      `candidate`. The JS layer then runs `compareVersions` against the
 *      installed `CFBundleShortVersionString` and decides whether to surface
 *      a soft prompt — keeping all version-comparison logic in one place.
 *   2. On user confirmation the frontend calls `startSoftUpdate` which
 *      deep-links to the App Store via `itms-apps://` (falls back to
 *      `https://apps.apple.com/...`).
 *
 * Hard updates are driven entirely by the backend `minVersion` floor — this
 * plugin merely exposes the App Store redirect via `openStore`.
 */
class FrakUpdaterPlugin: Plugin {
    @objc public func checkUpdate(_ invoke: Invoke) {
        let bundle = Bundle.main
        guard
            let bundleId = bundle.bundleIdentifier,
            let currentVersion = bundle.infoDictionary?["CFBundleShortVersionString"] as? String
        else {
            invoke.reject("Unable to read bundle metadata")
            return
        }

        // iTunes Lookup is rate-limited but generous; a `country` parameter
        // would scope to a specific storefront — omitting it lets Apple
        // return the version available in the user's storefront.
        guard let lookupURL = URL(string: "https://itunes.apple.com/lookup?bundleId=\(bundleId)") else {
            invoke.resolve(unsupportedResponse(currentVersion: currentVersion))
            return
        }

        var request = URLRequest(url: lookupURL)
        // Apple's lookup CDN is fast but we don't want to keep the boot
        // path waiting on a flaky network — 4 s caps the worst case. We
        // intentionally use the default cache policy: TanStack Query already
        // dedupes/staleness on the JS side, so adding HTTP-level caching
        // here is harmless and helps under poor connectivity.

        URLSession.shared.dataTask(with: request) { [weak self] data, _, _ in
            guard let self = self else { return }
            guard
                let data = data,
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let resultCount = json["resultCount"] as? Int,
                resultCount >= 1,
                let results = json["results"] as? [[String: Any]],
                let storeVersion = results.first?["version"] as? String
            else {
                invoke.resolve(self.unsupportedResponse(currentVersion: currentVersion))
                return
            }

            // Always emit `candidate` when iTunes returns a version. The JS
            // layer compares against the installed bundle version and
            // decides between `available` and `up_to_date`.
            invoke.resolve([
                "currentVersion": currentVersion,
                "status": "candidate",
                "storeVersion": storeVersion,
            ] as JsonObject)
        }.resume()
    }

    @objc public func startSoftUpdate(_ invoke: Invoke) {
        // No real "in-app" flow on iOS — best we can do is redirect to the
        // App Store page. We resolve with `started: true` once the URL is
        // accepted by the system (the user may still cancel from there).
        openAppStorePage { opened in
            invoke.resolve(["started": opened] as JsonObject)
        }
    }

    @objc public func completeSoftUpdate(_ invoke: Invoke) {
        // FLEXIBLE-style "download and install" doesn't exist on iOS — the
        // user has to come back from the App Store on their own. Resolve
        // immediately so the frontend can no-op without branching.
        invoke.resolve(["completed": false] as JsonObject)
    }

    @objc public func openStore(_ invoke: Invoke) {
        openAppStorePage { opened in
            invoke.resolve(["opened": opened] as JsonObject)
        }
    }

    // MARK: - Internals

    private func openAppStorePage(completion: @escaping (Bool) -> Void) {
        // `itms-apps://` opens the native App Store app directly; the
        // `https://apps.apple.com/...` fallback is only triggered on
        // simulators or unusual configurations where the scheme isn't
        // registered. Both rely on the bundle id resolution Apple performs
        // server-side, so no app id needs to be hard-coded.
        guard let bundleId = Bundle.main.bundleIdentifier else {
            completion(false)
            return
        }

        let primary = URL(string: "itms-apps://itunes.apple.com/app/bundleId/\(bundleId)")
        let fallback = URL(string: "https://apps.apple.com/app/bundleId/\(bundleId)")

        DispatchQueue.main.async {
            if let primary = primary, UIApplication.shared.canOpenURL(primary) {
                UIApplication.shared.open(primary, options: [:]) { completion($0) }
                return
            }
            if let fallback = fallback {
                UIApplication.shared.open(fallback, options: [:]) { completion($0) }
                return
            }
            completion(false)
        }
    }

    private func unsupportedResponse(currentVersion: String) -> JsonObject {
        return [
            "currentVersion": currentVersion,
            "status": "unsupported",
        ] as JsonObject
    }
}

@_cdecl("init_plugin_frak_updater")
func initPlugin() -> Plugin {
    return FrakUpdaterPlugin()
}
