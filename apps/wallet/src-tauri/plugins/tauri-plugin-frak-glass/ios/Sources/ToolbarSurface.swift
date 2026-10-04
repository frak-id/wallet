import UIKit

struct ToolbarMenuOptionArgs: Decodable, Equatable {
    let value: String
    let title: String
}

struct ToolbarMenuArgs: Decodable, Equatable {
    let title: String?
    let options: [ToolbarMenuOptionArgs]
    let selected: String?
}

struct ToolbarItemArgs: Decodable, Equatable {
    let id: String
    /// Asset-catalog image name, falling back to an SF Symbol of the same name.
    let icon: String
    /// VoiceOver label; the button shows no text.
    let label: String
    /// `#rrggbb` icon colour; the label colour when absent.
    let color: String?
    /// `#rrggbb` dot pinned to the top-trailing corner; no dot when absent.
    let badge: String?
    /// Single-choice menu opened by the button instead of a tap action.
    let menu: ToolbarMenuArgs?

    /// What needs a new button: anything else is updated in place, so a menu
    /// pick never swaps the button out under its own dismiss morph.
    var shape: [String?] { [id, menu == nil ? nil : "menu"] }
}

struct ToolbarArgs: Decodable {
    let id: String
    /// Points below the top safe-area inset; the row never sits above 16pt.
    let offsetTop: Double
    let leading: [ToolbarItemArgs]
    let trailing: [ToolbarItemArgs]
    let visible: Bool
}

/// Rows of 44pt Liquid Glass buttons pinned under the status bar, standing in
/// for a fixed web toolbar such as `DetailSheetActions`.
final class ToolbarSurface {
    private static let buttonSize: CGFloat = 44
    private static let edgeMargin: CGFloat = 16
    private static let itemSpacing: CGFloat = 8

    /// Item id, and the picked option's value for a menu item.
    private let onAction: (String, String?) -> Void
    private let container = PassthroughEffectView(effect: nil)
    private let leading = ToolbarEdge(isLeading: true)
    private let trailing = ToolbarEdge(isLeading: false)
    private var topConstraints: [NSLayoutConstraint] = []
    private var visible = false
    private var transition = 0

    init(in host: UIView, onAction: @escaping (String, String?) -> Void) {
        self.onAction = onAction
        // The web theme is light-only: dark glass over light pages reads as a bug.
        container.overrideUserInterfaceStyle = .light
        container.isHidden = true
        container.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            container.heightAnchor.constraint(equalToConstant: Self.buttonSize),
            container.topAnchor.constraint(
                greaterThanOrEqualTo: host.topAnchor, constant: Self.edgeMargin),
        ])
    }

    func update(_ args: ToolbarArgs, in host: UIView) {
        sync(leading, to: args.leading)
        sync(trailing, to: args.trailing)
        // A menu would lose its morph inside a container, so menu bars keep separate glass.
        let hasMenu = (args.leading + args.trailing).contains { $0.menu != nil }
        if hasMenu != (container.effect == nil) {
            container.effect = hasMenu ? nil : Glass.container(spacing: Self.itemSpacing / 2)
        }
        NSLayoutConstraint.deactivate(topConstraints)
        let top = container.topAnchor.constraint(
            equalTo: host.safeAreaLayoutGuide.topAnchor, constant: args.offsetTop)
        top.priority = .defaultHigh
        topConstraints = [top]
        NSLayoutConstraint.activate(topConstraints)
        host.layoutIfNeeded()
        setVisible(args.visible)
    }

    func hide() {
        setVisible(false)
    }

    private var elements: [UIView] { leading.views + trailing.views }

    private func sync(_ edge: ToolbarEdge, to next: [ToolbarItemArgs]) {
        defer { edge.items = next }
        if edge.items.map(\.shape) == next.map(\.shape) {
            for item in next { edge.buttons[item.id]?.apply(item) }
            return
        }
        edge.views.forEach { $0.removeFromSuperview() }
        edge.buttons = [:]
        edge.views = next.map { item in
            let button = ToolbarButton(item: item) { [weak self] value in
                self?.onAction(item.id, value)
            }
            edge.buttons[item.id] = button
            // Tap buttons join the container's shared glass; a menu button keeps its own.
            let view = item.menu == nil ? Glass.capsule(around: button) : button
            view.isHidden = !visible
            view.translatesAutoresizingMaskIntoConstraints = false
            container.contentView.addSubview(view)
            return view
        }
        layout(edge)
    }

    // Leading items flow from the leading margin, trailing ones from the trailing margin.
    private func layout(_ edge: ToolbarEdge) {
        let content = container.contentView
        let ordered = edge.isLeading ? edge.views : edge.views.reversed()
        var previous: UIView?
        for view in ordered {
            var constraints = [
                view.widthAnchor.constraint(equalToConstant: Self.buttonSize),
                view.heightAnchor.constraint(equalToConstant: Self.buttonSize),
                view.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            ]
            if edge.isLeading {
                constraints.append(
                    previous.map { view.leadingAnchor.constraint(equalTo: $0.trailingAnchor, constant: Self.itemSpacing) }
                        ?? view.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: Self.edgeMargin))
            } else {
                constraints.append(
                    previous.map { view.trailingAnchor.constraint(equalTo: $0.leadingAnchor, constant: -Self.itemSpacing) }
                        ?? view.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -Self.edgeMargin))
            }
            NSLayoutConstraint.activate(constraints)
            previous = view
        }
    }

    // Scales rather than fades: animating the alpha of a glass view breaks its effect.
    private func setVisible(_ visible: Bool) {
        guard visible != self.visible else { return }
        self.visible = visible
        if !visible {
            // An open menu would otherwise float on over whatever hid the toolbar.
            for button in [leading, trailing].flatMap({ $0.buttons.values }) {
                button.contextMenuInteraction?.dismissMenu()
            }
        }
        let views = elements
        let collapsed = CGAffineTransform(scaleX: 0.01, y: 0.01)
        if visible {
            container.isHidden = false
            for view in views where view.isHidden {
                view.transform = collapsed
                view.isHidden = false
            }
        }
        transition += 1
        let current = transition
        UIView.animate(
            withDuration: visible ? 0.45 : 0.2,
            delay: 0,
            usingSpringWithDamping: visible ? 0.75 : 1,
            initialSpringVelocity: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            for view in views {
                view.transform = visible ? .identity : collapsed
            }
        } completion: { [weak self] _ in
            // An interrupted animation completes too: only the latest one may hide.
            guard let self, current == self.transition, !self.visible else { return }
            views.forEach { $0.isHidden = true }
            self.container.isHidden = true
        }
    }
}

/// One side of the toolbar: its items, their views, and their buttons by id.
private final class ToolbarEdge {
    let isLeading: Bool
    var items: [ToolbarItemArgs] = []
    var views: [UIView] = []
    var buttons: [String: ToolbarButton] = [:]

    init(isLeading: Bool) {
        self.isLeading = isLeading
    }
}

/// One glass button: a tap action, or a single-choice menu that the iOS 26
/// button morphs into.
final class ToolbarButton: UIButton {
    private let onAction: (String?) -> Void
    private let badgeDot = UIView()
    private var applied: ToolbarItemArgs?

    init(item: ToolbarItemArgs, onAction: @escaping (String?) -> Void) {
        self.onAction = onAction
        super.init(frame: .zero)
        // A tap button's glass comes from the capsule around it.
        var configuration = item.menu == nil ? UIButton.Configuration.plain() : Glass.buttonConfiguration()
        configuration.cornerStyle = .capsule
        configuration.contentInsets = .zero
        self.configuration = configuration
        showsLargeContentViewer = true
        scalesLargeContentImage = true
        addInteraction(UILargeContentViewerInteraction())
        translatesAutoresizingMaskIntoConstraints = false
        if item.menu == nil {
            addAction(UIAction { [weak self] _ in self?.onAction(nil) }, for: .primaryActionTriggered)
        } else {
            showsMenuAsPrimaryAction = true
        }
        mountBadge()
        apply(item)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { nil }

    // Touches only what changed: this can land while the menu morphs back.
    func apply(_ item: ToolbarItemArgs) {
        defer { applied = item }
        if item.icon != applied?.icon {
            let image = Glass.icon(named: item.icon)
            configuration?.image = image
            largeContentImage = image
        }
        if applied == nil || item.color != applied?.color {
            configuration?.baseForegroundColor = item.color.flatMap(UIColor.init(hex:)) ?? .label
        }
        accessibilityLabel = item.label
        largeContentTitle = item.label
        badgeDot.backgroundColor = item.badge.flatMap(UIColor.init(hex:))
        badgeDot.isHidden = badgeDot.backgroundColor == nil
        guard let args = item.menu, args != applied?.menu else { return }
        menu = UIMenu(
            title: args.title ?? "",
            options: .singleSelection,
            children: args.options.map { option in
                UIAction(title: option.title, state: option.value == args.selected ? .on : .off) {
                    [weak self] _ in self?.onAction(option.value)
                }
            })
    }

    // 5pt dot 8.5pt in from the top-trailing corner, as on the web button.
    private func mountBadge() {
        badgeDot.isUserInteractionEnabled = false
        badgeDot.layer.cornerRadius = 2.5
        badgeDot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(badgeDot)
        NSLayoutConstraint.activate([
            badgeDot.widthAnchor.constraint(equalToConstant: 5),
            badgeDot.heightAnchor.constraint(equalToConstant: 5),
            badgeDot.topAnchor.constraint(equalTo: topAnchor, constant: 8.5),
            badgeDot.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8.5),
        ])
    }
}

/// Lets touches between and around the buttons fall through to the webview.
final class PassthroughEffectView: UIVisualEffectView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hit = super.hitTest(point, with: event), hit !== contentView,
            hit.isDescendant(of: contentView)
        else { return nil }
        return hit
    }
}
