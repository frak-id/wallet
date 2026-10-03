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

/// A row of 44pt Liquid Glass buttons pinned under the status bar, standing in
/// for a fixed web toolbar such as `DetailSheetActions`.
final class ToolbarSurface {
    private static let buttonSize: CGFloat = 44
    private static let edgeMargin: CGFloat = 16

    /// Item id, and the picked option's value for a menu item.
    private let onAction: (String, String?) -> Void
    private let leadingRow = PassthroughStackView()
    private let trailingRow = PassthroughStackView()
    private var topConstraints: [NSLayoutConstraint] = []
    private var leading: [ToolbarItemArgs] = []
    private var trailing: [ToolbarItemArgs] = []
    private var buttons: [String: ToolbarButton] = [:]
    private var visible = false
    private var transition = 0

    init(in host: UIView, onAction: @escaping (String, String?) -> Void) {
        self.onAction = onAction
        for row in [leadingRow, trailingRow] {
            row.axis = .horizontal
            row.spacing = 8
            // The web theme is light-only: dark glass over light pages reads as a bug.
            row.overrideUserInterfaceStyle = .light
            row.isHidden = true
            row.translatesAutoresizingMaskIntoConstraints = false
            host.addSubview(row)
        }
        NSLayoutConstraint.activate([
            leadingRow.leadingAnchor.constraint(
                equalTo: host.leadingAnchor, constant: Self.edgeMargin),
            trailingRow.trailingAnchor.constraint(
                equalTo: host.trailingAnchor, constant: -Self.edgeMargin),
            trailingRow.topAnchor.constraint(equalTo: leadingRow.topAnchor),
            leadingRow.topAnchor.constraint(
                greaterThanOrEqualTo: host.topAnchor, constant: Self.edgeMargin),
        ])
    }

    func update(_ args: ToolbarArgs, in host: UIView) {
        leading = sync(leadingRow, from: leading, to: args.leading)
        trailing = sync(trailingRow, from: trailing, to: args.trailing)
        NSLayoutConstraint.deactivate(topConstraints)
        let top = leadingRow.topAnchor.constraint(
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

    private func sync(
        _ row: UIStackView, from current: [ToolbarItemArgs], to next: [ToolbarItemArgs]
    ) -> [ToolbarItemArgs] {
        if current.map(\.shape) == next.map(\.shape) {
            for item in next { buttons[item.id]?.apply(item) }
            return next
        }
        // Both rows share `buttons`: an id that just moved rows belongs to the other one now.
        for item in current where buttons[item.id]?.superview === row { buttons[item.id] = nil }
        for button in row.arrangedSubviews {
            button.removeFromSuperview()
        }
        for item in next {
            let button = ToolbarButton(item: item) { [weak self] value in
                self?.onAction(item.id, value)
            }
            buttons[item.id] = button
            row.addArrangedSubview(button)
            NSLayoutConstraint.activate([
                button.widthAnchor.constraint(equalToConstant: Self.buttonSize),
                button.heightAnchor.constraint(equalToConstant: Self.buttonSize),
            ])
        }
        return next
    }

    // Scales rather than fades: animating the alpha of a glass view breaks its effect.
    private func setVisible(_ visible: Bool) {
        guard visible != self.visible else { return }
        self.visible = visible
        if !visible {
            // An open menu would otherwise float on over whatever hid the toolbar.
            for button in buttons.values { button.contextMenuInteraction?.dismissMenu() }
        }
        let rows = [leadingRow, trailingRow]
        let collapsed = CGAffineTransform(scaleX: 0.01, y: 0.01)
        if visible {
            for row in rows where row.isHidden {
                row.transform = collapsed
                row.isHidden = false
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
            for row in rows {
                row.transform = visible ? .identity : collapsed
            }
        } completion: { [weak self] _ in
            // An interrupted animation completes too: only the latest one may hide.
            guard let self, current == self.transition, !self.visible else { return }
            rows.forEach { $0.isHidden = true }
        }
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
        var configuration = Glass.buttonConfiguration()
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
final class PassthroughStackView: UIStackView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
