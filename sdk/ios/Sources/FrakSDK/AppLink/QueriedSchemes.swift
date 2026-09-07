import Foundation

/// Whether `canOpenURL` can answer meaningfully for a given scheme, decided from the merchant's
/// own `LSApplicationQueriesSchemes` rather than inferred from a probe that cannot tell "not
/// declared" apart from "not installed".
///
/// `@_spi`: wire plumbing for `FrakSDKUI`'s install detector, not merchant API.
@_spi(FrakInternal)
public enum ProbeStatus: Sendable, Equatable {
    case ok
    case undeclared
    /// The merchant turned detection off. Distinct from `undeclared` so a deliberate opt-out is
    /// not reported, or logged, as a misconfiguration.
    case disabled
}

@_spi(FrakInternal)
public enum QueriedSchemes {
    /// `canOpenURL` fails silently below this; declaring past it makes every later entry
    /// unreliable, not just the new ones. Warn-only — behaviour past the cap is undocumented.
    public static let cap = 50

    /// `declared` is the merchant's own `LSApplicationQueriesSchemes`, read once by the caller.
    /// Never `Bundle.main` in here — under `swift test` that bundle is the test host, not the
    /// merchant's, and the function would answer wrong silently.
    public static func declares(_ scheme: String, in declared: [String]) -> Bool {
        declared.contains { $0.caseInsensitiveCompare(scheme) == .orderedSame }
    }

    public static func status(for scheme: String, declared: [String]) -> ProbeStatus {
        declares(scheme, in: declared) ? .ok : .undeclared
    }

    public static func isAtCap(_ declared: [String]) -> Bool {
        declared.count >= cap
    }
}

#if canImport(UIKit)
    import UIKit

    @_spi(FrakInternal)
    extension QueriedSchemes {
        /// The one call site that reads the host app's own declaration.
        public static func declaredInMainBundle() -> [String] {
            Bundle.main.object(forInfoDictionaryKey: "LSApplicationQueriesSchemes") as? [String] ?? []
        }
    }
#endif
