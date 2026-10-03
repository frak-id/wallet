import UIKit

struct ToolbarItemArgs: Decodable, Equatable {
    let id: String
    /// Asset-catalog image name, falling back to an SF Symbol of the same name.
    let icon: String
    /// VoiceOver label; the button shows no text.
    let label: String
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

    private let onAction: (String) -> Void
    private let leadingRow = PassthroughStackView()
    private let trailingRow = PassthroughStackView()
    private var topConstraints: [NSLayoutConstraint] = []
    private var leading: [ToolbarItemArgs] = []
    private var trailing: [ToolbarItemArgs] = []
    private var visible = false
    private var transition = 0

    init(in host: UIView, onAction: @escaping (String) -> Void) {
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
        if args.leading != leading {
            leading = args.leading
            fill(leadingRow, with: leading)
        }
        if args.trailing != trailing {
            trailing = args.trailing
            fill(trailingRow, with: trailing)
        }
        NSLayoutConstraint.deactivate(topConstraints)
        let top = leadingRow.topAnchor.constraint(
            equalTo: host.safeAreaLayoutGuide.topAnchor, constant: args.offsetTop)
        top.priority = .defaultHigh
        topConstraints = [top]
        NSLayoutConstraint.activate(topConstraints)
        host.layoutIfNeeded()
        setVisible(args.visible)
    }

    private func fill(_ row: UIStackView, with items: [ToolbarItemArgs]) {
        row.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for item in items {
            row.addArrangedSubview(makeButton(item))
        }
    }

    private func makeButton(_ item: ToolbarItemArgs) -> UIButton {
        var configuration = Glass.buttonConfiguration()
        configuration.image = Glass.icon(named: item.icon)
        configuration.baseForegroundColor = .label
        configuration.cornerStyle = .capsule
        configuration.contentInsets = .zero
        let button = UIButton(
            configuration: configuration,
            primaryAction: UIAction { [weak self] _ in self?.onAction(item.id) })
        button.accessibilityLabel = item.label
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: Self.buttonSize),
            button.heightAnchor.constraint(equalToConstant: Self.buttonSize),
        ])
        return button
    }

    // Scales rather than fades: animating the alpha of a glass view breaks its effect.
    private func setVisible(_ visible: Bool) {
        guard visible != self.visible else { return }
        self.visible = visible
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

/// Lets touches between and around the buttons fall through to the webview.
final class PassthroughStackView: UIStackView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }
}
