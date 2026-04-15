import SwiftRs
import Tauri
import UIKit

class InstallReferrerPlugin: Plugin {
    @objc public func getInstallReferrer(_ invoke: Invoke) {
        invoke.reject("Play Install Referrer is only available on Android")
    }
}

@_cdecl("init_plugin_install_referrer")
func initPlugin() -> Plugin {
    return InstallReferrerPlugin()
}
