import SwiftRs
import Tauri
import UIKit
import WebKit

struct TabItemArgs: Decodable, Equatable {
    let key: String
    let title: String
    /// Asset-catalog image name, falling back to an SF Symbol of the same name.
    let icon: String
}

struct UpdateArgs: Decodable {
    let items: [TabItemArgs]
    let selectedKey: String?
    let visible: Bool
    /// `#rrggbb` accent for the selected item.
    let tint: String?
}

/// A system `UITabBar` floated over the webview: built against the iOS 26 SDK
/// it renders as Liquid Glass and samples the web content scrolling under it.
/// The web router stays the source of truth — `update` mirrors its state in,
/// taps go back out as `tabSelected` events.
class FrakTabBarPlugin: Plugin, UITabBarDelegate {
    private weak var webview: WKWebView?
    private var tabBar: UITabBar?
    private var items: [TabItemArgs] = []
    private var tint: String?
    private var visible = false

    // Glass needs the iOS 26 SDK at build time AND iOS 26 at run time; anything
    // less gets the opaque pre-26 bar, which is worse than the web one.
    private static var isGlassAvailable: Bool {
        #if compiler(>=6.2)
            if #available(iOS 26.0, *) { return true }
        #endif
        return false
    }

    @objc public override func load(webview: WKWebView) {
        self.webview = webview
    }

    @objc public func isSupported(_ invoke: Invoke) {
        invoke.resolve(["supported": Self.isGlassAvailable] as JsonObject)
    }

    @objc public func update(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(UpdateArgs.self)
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard Self.isGlassAvailable else {
                invoke.reject("Liquid Glass tab bar requires iOS 26")
                return
            }
            guard let host = self.webview?.superview ?? self.manager.viewController?.view else {
                invoke.reject("No host view for the tab bar")
                return
            }
            let bar = self.tabBar ?? self.mount(in: host)
            self.apply(args, to: bar)
            host.layoutIfNeeded()
            self.setVisible(args.visible, bar: bar)
            invoke.resolve(["height": Double(bar.bounds.height)] as JsonObject)
        }
    }

    // MARK: - UITabBarDelegate

    // Fires on re-taps too; the web side tells a re-tap from a switch.
    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard items.indices.contains(item.tag) else { return }
        trigger("tabSelected", data: ["key": items[item.tag].key] as JSObject)
    }

    // MARK: - Internals

    private func mount(in host: UIView) -> UITabBar {
        let bar = UITabBar()
        bar.delegate = self
        // The web theme is light-only: dark glass over light pages reads as a bug.
        bar.overrideUserInterfaceStyle = .light
        bar.isHidden = true
        bar.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            bar.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])
        tabBar = bar
        return bar
    }

    private func apply(_ args: UpdateArgs, to bar: UITabBar) {
        if args.items != items {
            items = args.items
            let barItems = items.enumerated().map { index, item in
                UITabBarItem(title: item.title, image: Self.icon(named: item.icon), tag: index)
            }
            bar.setItems(barItems, animated: false)
        }
        if args.tint != tint {
            tint = args.tint
            applyTint(args.tint.flatMap(UIColor.init(hex:)), to: bar)
        }
        let index = args.selectedKey.flatMap { key in items.firstIndex { $0.key == key } }
        if let index, let barItems = bar.items, barItems.indices.contains(index) {
            bar.selectedItem = barItems[index]
        } else {
            bar.selectedItem = nil
        }
    }

    // Only the selected-item colours change: any background customisation on the
    // appearance replaces the Liquid Glass material.
    private func applyTint(_ color: UIColor?, to bar: UITabBar) {
        bar.tintColor = color
        let appearance = bar.standardAppearance
        for layout in [
            appearance.stackedLayoutAppearance,
            appearance.inlineLayoutAppearance,
            appearance.compactInlineLayoutAppearance,
        ] {
            layout.selected.iconColor = color
            layout.selected.titleTextAttributes = color.map { [.foregroundColor: $0] } ?? [:]
        }
        bar.standardAppearance = appearance
        bar.scrollEdgeAppearance = appearance
    }

    // Slides rather than fades: animating the alpha of a glass view breaks its effect.
    private func setVisible(_ visible: Bool, bar: UITabBar) {
        guard visible != self.visible else { return }
        self.visible = visible
        let offscreen = CGAffineTransform(translationX: 0, y: bar.bounds.height)
        if visible && bar.isHidden {
            bar.transform = offscreen
            bar.isHidden = false
        }
        UIView.animate(
            withDuration: 0.35,
            delay: 0,
            usingSpringWithDamping: 1,
            initialSpringVelocity: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            bar.transform = visible ? .identity : offscreen
        } completion: { [weak self] _ in
            if self?.visible == false { bar.isHidden = true }
        }
    }

    private static func icon(named name: String) -> UIImage? {
        (UIImage(named: name) ?? UIImage(systemName: name))?.withRenderingMode(.alwaysTemplate)
    }
}

extension UIColor {
    fileprivate convenience init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}

@_cdecl("init_plugin_frak_tab_bar")
func initPlugin() -> Plugin {
    return FrakTabBarPlugin()
}
