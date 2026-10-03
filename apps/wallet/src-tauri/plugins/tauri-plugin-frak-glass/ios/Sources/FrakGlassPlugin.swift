import SwiftRs
import Tauri
import UIKit
import WebKit

/// Native Liquid Glass chrome floated over the webview (iOS 26+). The web app
/// stays the source of truth: commands mirror its state in, and user actions
/// go back out as plugin events.
class FrakGlassPlugin: Plugin {
    private weak var webview: WKWebView?
    private lazy var tabBar = TabBarSurface { [weak self] key in
        self?.trigger("tabSelected", data: ["key": key] as JSObject)
    }
    // Never removed, only hidden: ids are a fixed set of screens.
    private var toolbars: [String: ToolbarSurface] = [:]

    @objc public override func load(webview: WKWebView) {
        self.webview = webview
    }

    @objc public func isSupported(_ invoke: Invoke) {
        invoke.resolve(["supported": Glass.isAvailable] as JsonObject)
    }

    @objc public func setTabBar(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(TabBarArgs.self)
        onHost(invoke) { host in
            let height = self.tabBar.update(args, in: host)
            invoke.resolve(["height": Double(height)] as JsonObject)
        }
    }

    @objc public func setToolbar(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ToolbarArgs.self)
        onHost(invoke) { host in
            let toolbar = self.toolbars[args.id] ?? self.makeToolbar(id: args.id, in: host)
            toolbar.update(args, in: host)
            invoke.resolve()
        }
    }

    private func makeToolbar(id: String, in host: UIView) -> ToolbarSurface {
        let toolbar = ToolbarSurface(in: host) { [weak self] itemId, value in
            var data: JSObject = ["toolbarId": id, "itemId": itemId]
            data["value"] = value
            self?.trigger("toolbarAction", data: data)
        }
        toolbars[id] = toolbar
        return toolbar
    }

    /// Runs `body` on the main queue with the view hosting the webview, or rejects.
    private func onHost(_ invoke: Invoke, _ body: @escaping (UIView) -> Void) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard Glass.isAvailable else {
                invoke.reject("Liquid Glass chrome requires iOS 26")
                return
            }
            guard let host = self.webview?.superview ?? self.manager.viewController?.view else {
                invoke.reject("No host view for the native chrome")
                return
            }
            body(host)
        }
    }
}

@_cdecl("init_plugin_frak_glass")
func initPlugin() -> Plugin {
    return FrakGlassPlugin()
}
