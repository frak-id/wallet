import UIKit

struct BottomActionArgs: Decodable {
    let title: String
    /// Asset-catalog image after the title, or an SF Symbol name.
    let icon: String?
    let enabled: Bool
    /// Spinner in place of the icon while the action is in flight.
    let loading: Bool
    let visible: Bool
    /// `#rrggbb` fill of the prominent glass.
    let tint: String?
}

/// A full-width prominent glass button floating above the home indicator, the
/// native twin of a sheet's primary CTA.
final class BottomActionSurface {
    private static let height: CGFloat = 48
    private static let edgeMargin: CGFloat = 16
    private static let bottomGap: CGFloat = 8

    private let button = UIButton(configuration: Glass.buttonConfiguration(prominent: true))
    private var visible = false
    private var transition = 0

    init(in host: UIView, onPress: @escaping () -> Void) {
        button.addAction(UIAction { _ in onPress() }, for: .primaryActionTriggered)
        // The web theme is light-only: dark glass over light pages reads as a bug.
        button.overrideUserInterfaceStyle = .light
        button.isHidden = true
        // Its title stays 14pt like the web twin's: long-press shows it large instead.
        button.showsLargeContentViewer = true
        button.addInteraction(UILargeContentViewerInteraction())
        button.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(button)
        // Home-button iPhones have no bottom inset: keep the side margin there too.
        let aboveHomeIndicator = button.bottomAnchor.constraint(
            equalTo: host.safeAreaLayoutGuide.bottomAnchor, constant: -Self.bottomGap)
        aboveHomeIndicator.priority = .defaultHigh
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(
                equalTo: host.leadingAnchor, constant: Self.edgeMargin),
            button.trailingAnchor.constraint(
                equalTo: host.trailingAnchor, constant: -Self.edgeMargin),
            aboveHomeIndicator,
            button.bottomAnchor.constraint(
                lessThanOrEqualTo: host.bottomAnchor, constant: -Self.edgeMargin),
            button.heightAnchor.constraint(equalToConstant: Self.height),
        ])
    }

    /// Returns the height the button occludes at the bottom of the screen.
    func update(_ args: BottomActionArgs, in host: UIView) -> CGFloat {
        var configuration = button.configuration ?? Glass.buttonConfiguration(prominent: true)
        configuration.attributedTitle = AttributedString(
            args.title,
            attributes: AttributeContainer([.font: UIFont.systemFont(ofSize: 14, weight: .semibold)]))
        configuration.image = args.icon.flatMap(Glass.icon(named:))
        configuration.imagePlacement = .trailing
        configuration.imagePadding = 8
        configuration.showsActivityIndicator = args.loading
        configuration.baseForegroundColor = .white
        configuration.cornerStyle = .capsule
        button.configuration = configuration
        button.tintColor = args.tint.flatMap(UIColor.init(hex:))
        button.isEnabled = args.enabled && !args.loading
        button.accessibilityLabel = args.title
        button.largeContentTitle = args.title
        host.layoutIfNeeded()
        setVisible(args.visible, in: host)
        return occludedHeight(in: host)
    }

    // From the resting top edge: `center` and `bounds` ignore the slide transform.
    private func occludedHeight(in host: UIView) -> CGFloat {
        host.bounds.height - (button.center.y - button.bounds.height / 2)
    }

    // Slides up from below the screen edge, like a sheet's own CTA would.
    private func setVisible(_ visible: Bool, in host: UIView) {
        guard visible != self.visible else { return }
        self.visible = visible
        let offscreen = CGAffineTransform(translationX: 0, y: occludedHeight(in: host))
        if visible && button.isHidden {
            button.transform = offscreen
            button.isHidden = false
        }
        transition += 1
        let current = transition
        UIView.animate(
            withDuration: visible ? 0.45 : 0.25,
            delay: 0,
            usingSpringWithDamping: visible ? 0.85 : 1,
            initialSpringVelocity: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            self.button.transform = visible ? .identity : offscreen
        } completion: { [weak self] _ in
            // An interrupted animation completes too: only the latest one may hide.
            guard let self, current == self.transition, !self.visible else { return }
            self.button.isHidden = true
        }
    }
}
