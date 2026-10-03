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
