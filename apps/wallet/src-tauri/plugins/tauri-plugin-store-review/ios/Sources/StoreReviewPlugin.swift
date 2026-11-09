import StoreKit
import SwiftRs
import Tauri
import UIKit

class StoreReviewPlugin: Plugin {
    @objc public func requestReview(_ invoke: Invoke) {
        DispatchQueue.main.async {
            guard
                let scene = UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
            else {
                invoke.resolve(["requested": false])
                return
            }
            AppStore.requestReview(in: scene)
            invoke.resolve(["requested": true])
        }
    }
}

@_cdecl("init_plugin_store_review")
func initPlugin() -> Plugin {
    return StoreReviewPlugin()
}
