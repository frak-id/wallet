import UIKit

enum Glass {
    // Glass needs the iOS 26 SDK at build time AND iOS 26 at run time; anything
    // less gets the opaque pre-26 chrome, which is worse than the web one.
    static var isAvailable: Bool {
        #if compiler(>=6.2)
            if #available(iOS 26.0, *) { return true }
        #endif
        return false
    }

    /// Asset-catalog image, falling back to an SF Symbol of the same name.
    static func icon(named name: String) -> UIImage? {
        (UIImage(named: name) ?? UIImage(systemName: name))?.withRenderingMode(.alwaysTemplate)
    }

    static func buttonConfiguration(prominent: Bool = false) -> UIButton.Configuration {
        #if compiler(>=6.2)
            if #available(iOS 26.0, *) { return prominent ? .prominentGlass() : .glass() }
        #endif
        return prominent ? .filled() : .gray()
    }

    /// An interactive glass capsule hosting `content`, for a `container` to adapt as one.
    static func capsule(around content: UIView) -> UIView {
        #if compiler(>=6.2)
            if #available(iOS 26.0, *) {
                let effect = UIGlassEffect(style: .regular)
                effect.isInteractive = true
                let capsule = UIVisualEffectView(effect: effect)
                capsule.cornerConfiguration = .capsule()
                capsule.contentView.addSubview(content)
                content.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    content.topAnchor.constraint(equalTo: capsule.contentView.topAnchor),
                    content.bottomAnchor.constraint(equalTo: capsule.contentView.bottomAnchor),
                    content.leadingAnchor.constraint(equalTo: capsule.contentView.leadingAnchor),
                    content.trailingAnchor.constraint(equalTo: capsule.contentView.trailingAnchor),
                ])
                return capsule
            }
        #endif
        return content
    }

    /// Renders the glass views nested in its `contentView` together: one light/dark
    /// adaptation for all, merging only those closer than `spacing`.
    static func container(spacing: CGFloat) -> UIVisualEffect? {
        #if compiler(>=6.2)
            if #available(iOS 26.0, *) {
                let effect = UIGlassContainerEffect()
                effect.spacing = spacing
                return effect
            }
        #endif
        return nil
    }
}

extension UIColor {
    /// `#rrggbb`, or nil when malformed.
    convenience init?(hex: String) {
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
