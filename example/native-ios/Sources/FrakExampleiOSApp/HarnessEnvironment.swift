import Foundation
import FrakSDK

/// A Frak stage the harness can run against, with the merchant id that exists on it. Each stage is
/// a separate backend deployment, so a merchant id is only resolvable on the one it was created on.
enum HarnessEnvironment: String, CaseIterable, Identifiable, Sendable {
    case development
    case production

    var id: String { rawValue }

    var label: String {
        switch self {
        case .development: "Development"
        case .production: "Production"
        }
    }

    var merchantId: String {
        switch self {
        case .development: "0a799880-ba54-4276-a734-db8721911bab"
        case .production: "dab86a41-f685-470d-91c8-e87af5834af9"
        }
    }

    var frakEnvironment: FrakEnvironment {
        switch self {
        case .development: .development
        case .production: .production
        }
    }

    var backendOrigin: String { frakEnvironment.backend }
}

/// The selected stage, persisted so it survives the relaunch that applies it. `UserDefaults.standard`
/// is the harness's own domain, never one of the suites the SDK keeps identity and consent in.
enum HarnessEnvironmentStore {
    private static let key = "frak.harness.environment"

    static func read() -> HarnessEnvironment {
        guard let stored = UserDefaults.standard.string(forKey: key) else { return .development }
        return HarnessEnvironment(rawValue: stored) ?? .development
    }

    static func write(_ environment: HarnessEnvironment) {
        UserDefaults.standard.set(environment.rawValue, forKey: key)
    }
}
