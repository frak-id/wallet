import SwiftRs
import Tauri
import UIKit
import WebKit

class AppSettingsPlugin: Plugin {
    @objc public func openNotificationSettings(_ invoke: Invoke) {
        DispatchQueue.main.async {
            var settingsUrl: URL?

            if #available(iOS 16.0, *) {
                settingsUrl = URL(string: UIApplication.openNotificationSettingsURLString)
            }

            if settingsUrl == nil {
                settingsUrl = URL(string: UIApplication.openSettingsURLString)
            }

            guard let url = settingsUrl,
                  UIApplication.shared.canOpenURL(url) else {
                invoke.reject("Cannot open app settings")
                return
            }

            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    invoke.resolve()
                } else {
                    invoke.reject("Failed to open app settings")
                }
            }
        }
    }
}

@_cdecl("init_plugin_app_settings")
func initPlugin() -> Plugin {
    return AppSettingsPlugin()
}
