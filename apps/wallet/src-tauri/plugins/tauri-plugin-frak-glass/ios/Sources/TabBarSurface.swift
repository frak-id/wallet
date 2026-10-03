import UIKit

struct TabItemArgs: Decodable, Equatable {
    let key: String
    let title: String
    /// Asset-catalog image name, falling back to an SF Symbol of the same name.
    let icon: String
}

struct TabBarArgs: Decodable {
    let items: [TabItemArgs]
    let selectedKey: String?
    let visible: Bool
    /// `#rrggbb` accent for the selected item.
    let tint: String?
}

/// A system `UITabBar` pinned to the bottom of the host view: built against the
/// iOS 26 SDK it renders as Liquid Glass and samples the web content under it.
final class TabBarSurface: NSObject, UITabBarDelegate {
    private let onSelect: (String) -> Void
    private var bar: UITabBar?
    private var items: [TabItemArgs] = []
    private var tint: String?
    private var visible = false
    private var transition = 0

    init(onSelect: @escaping (String) -> Void) {
        self.onSelect = onSelect
    }

    /// Returns the height the bar occludes at the bottom of the screen.
    func update(_ args: TabBarArgs, in host: UIView) -> CGFloat {
        let bar = self.bar ?? mount(in: host)
        apply(args, to: bar)
        host.layoutIfNeeded()
        setVisible(args.visible, bar: bar)
        return bar.bounds.height
    }

    // Fires on re-taps too; the web side tells a re-tap from a switch.
    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard items.indices.contains(item.tag) else { return }
        onSelect(items[item.tag].key)
    }

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
        self.bar = bar
        return bar
    }

    private func apply(_ args: TabBarArgs, to bar: UITabBar) {
        if args.items != items {
            items = args.items
            let barItems = items.enumerated().map { index, item in
                UITabBarItem(title: item.title, image: Glass.icon(named: item.icon), tag: index)
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
        transition += 1
        let current = transition
        UIView.animate(
            withDuration: 0.35,
            delay: 0,
            usingSpringWithDamping: 1,
            initialSpringVelocity: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            bar.transform = visible ? .identity : offscreen
        } completion: { [weak self] _ in
            // An interrupted animation completes too: only the latest one may hide.
            guard let self, current == self.transition, !self.visible else { return }
            bar.isHidden = true
        }
    }
}
