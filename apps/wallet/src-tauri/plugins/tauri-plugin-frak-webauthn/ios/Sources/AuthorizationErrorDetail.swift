import Foundation
import LocalAuthentication

private let authorizationFailedCode = 1004

func authorizationErrorDetail(
    _ error: Error,
    deviceOwnerAuth: () -> String = deviceOwnerAuthStatus
) -> String {
    let nsError = error as NSError
    var parts = ["[\(nsError.code)] \(error.localizedDescription)"]
    for underlying in underlyingErrors(of: nsError) {
        parts.append(describeUnderlying(underlying))
        if let nested = underlying.userInfo[NSUnderlyingErrorKey] as? NSError {
            parts.append(describeUnderlying(nested))
        }
    }
    if nsError.code == authorizationFailedCode {
        parts.append("deviceOwnerAuth=\(deviceOwnerAuth())")
    }
    return parts.joined(separator: "; ")
}

func deviceOwnerAuthStatus() -> String {
    var laError: NSError?
    if LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &laError) {
        return "ok"
    }
    guard let laError else { return "n/a" }
    switch LAError.Code(rawValue: laError.code) {
    case .passcodeNotSet: return "passcodeNotSet"
    case .biometryNotAvailable: return "biometryNotAvailable"
    case .biometryNotEnrolled: return "biometryNotEnrolled"
    case .biometryLockout: return "biometryLockout"
    default: return String(laError.code)
    }
}

private func underlyingErrors(of error: NSError) -> [NSError] {
    var errors: [NSError] = []
    if let single = error.userInfo[NSUnderlyingErrorKey] as? NSError {
        errors.append(single)
    }
    if let many = error.userInfo[NSMultipleUnderlyingErrorsKey] as? [NSError] {
        errors.append(contentsOf: many)
    }
    return errors
}

// Domain and code only: the JS classifier keyword-matches this message, so Apple's prose must stay out.
private func describeUnderlying(_ error: NSError) -> String {
    "underlying=\(error.domain)#\(error.code)"
}
