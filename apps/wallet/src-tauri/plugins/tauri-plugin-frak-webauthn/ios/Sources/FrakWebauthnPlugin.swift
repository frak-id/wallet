import AuthenticationServices
import SwiftRs
import Tauri
import UIKit

class FrakWebauthnPlugin: Plugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var pendingInvoke: Invoke?
    private var isRegistration = false

    @objc public func register(_ invoke: Invoke) {
        guard #available(iOS 16.0, *) else {
            invoke.reject("Passkeys require iOS 16.0 or later")
            return
        }

        guard let args = try? invoke.getArgs(),
              let options = args.getObject("options") else {
            invoke.reject("Missing or invalid 'options' parameter")
            return
        }

        guard let challengeB64 = options.getString("challenge"),
              let challengeData = Data(base64URLEncoded: challengeB64) else {
            invoke.reject("Invalid or missing 'challenge'")
            return
        }

        guard let rpObj = options.getObject("rp"),
              let rpId = rpObj.getString("id") else {
            invoke.reject("Invalid or missing 'rp.id'")
            return
        }

        guard let userObj = options.getObject("user"),
              let userIdB64 = userObj.getString("id"),
              let userId = Data(base64URLEncoded: userIdB64),
              let userName = userObj.getString("name") else {
            invoke.reject("Invalid or missing 'user'")
            return
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialRegistrationRequest(
            challenge: challengeData,
            name: userName,
            userID: userId
        )

        if let userDisplayName = userObj.getString("displayName") {
            request.displayName = userDisplayName
        }

        pendingInvoke = invoke
        isRegistration = true

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    @objc public func authenticate(_ invoke: Invoke) {
        guard #available(iOS 16.0, *) else {
            invoke.reject("Passkeys require iOS 16.0 or later")
            return
        }

        guard let args = try? invoke.getArgs(),
              let options = args.getObject("options") else {
            invoke.reject("Missing or invalid 'options' parameter")
            return
        }

        guard let challengeB64 = options.getString("challenge"),
              let challengeData = Data(base64URLEncoded: challengeB64) else {
            invoke.reject("Invalid or missing 'challenge'")
            return
        }

        let rpId = options.getString("rpId") ?? ""

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challengeData)

        if let allowCredentials = options.getArray("allowCredentials") {
            request.allowedCredentials = allowCredentials.compactMap { item in
                guard let cred = item as? JSObject,
                      let idB64 = cred.getString("id"),
                      let idData = Data(base64URLEncoded: idB64) else { return nil }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: idData)
            }
        }

        pendingInvoke = invoke
        isRegistration = false

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    // MARK: - ASAuthorizationControllerDelegate

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let invoke = pendingInvoke else { return }
        pendingInvoke = nil

        if #available(iOS 16.0, *) {
            if let registration = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
                resolveRegistration(invoke: invoke, credential: registration)
                return
            }

            if let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
                resolveAssertion(invoke: invoke, credential: assertion)
                return
            }
        }

        invoke.reject("Unexpected credential type")
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError {
            if authError.code == .canceled {
                pendingInvoke?.reject("NotAllowedError")
            } else if authError.code.rawValue == 1006 {
                // matchedExcludedCredential (iOS 16.6+) — credential already registered
                pendingInvoke?.reject("InvalidStateError")
            } else {
                pendingInvoke?.reject(error.localizedDescription)
            }
        } else {
            pendingInvoke?.reject(error.localizedDescription)
        }
        pendingInvoke = nil
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    // MARK: - Response builders

    @available(iOS 16.0, *)
    private func resolveRegistration(invoke: Invoke, credential: ASAuthorizationPlatformPublicKeyCredentialRegistration) {
        let credentialIdB64 = credential.credentialID.base64URLEncodedString()
        let attestationData = credential.rawAttestationObject ?? Data()

        // ASAuthorization doesn't expose the public key in SPKI DER form, so we
        // reconstruct it from the COSE key embedded in `attestationObject` and
        // surface it as `publicKey` — matching the Android Credential Manager
        // response shape and letting the JS bridge stay platform-agnostic.
        let publicKeyB64 = extractSpkiFromAttestation(attestationData)?
            .base64URLEncodedString()

        var responseObj: JsonObject = [
            "clientDataJSON": credential.rawClientDataJSON.base64URLEncodedString(),
            "attestationObject": attestationData.base64URLEncodedString(),
            "transports": ["internal"] as [String],
            "publicKeyAlgorithm": -7,
        ]
        if let publicKeyB64 = publicKeyB64 {
            responseObj["publicKey"] = publicKeyB64
        }

        let result: JsonObject = [
            "id": credentialIdB64,
            "rawId": credentialIdB64,
            "type": "public-key",
            "response": responseObj,
            "authenticatorAttachment": "platform",
            "clientExtensionResults": [String: Any?](),
        ]

        invoke.resolve(result)
    }

    @available(iOS 16.0, *)
    private func resolveAssertion(invoke: Invoke, credential: ASAuthorizationPlatformPublicKeyCredentialAssertion) {
        let credentialIdB64 = credential.credentialID.base64URLEncodedString()

        let responseObj: JsonObject = [
            "clientDataJSON": credential.rawClientDataJSON.base64URLEncodedString(),
            "authenticatorData": credential.rawAuthenticatorData.base64URLEncodedString(),
            "signature": credential.signature.base64URLEncodedString(),
            "userHandle": credential.userID.base64URLEncodedString(),
        ]

        let result: JsonObject = [
            "id": credentialIdB64,
            "rawId": credentialIdB64,
            "type": "public-key",
            "response": responseObj,
            "authenticatorAttachment": "platform",
            "clientExtensionResults": [String: Any?](),
        ]

        invoke.resolve(result)
    }
}

// MARK: - SPKI extraction (P-256)
//
// iOS ASAuthorization only exposes the raw `attestationObject` (CBOR). To
// surface the public key in the same SPKI DER format Android emits we scan
// for the COSE x/y coordinate markers and prepend the static P-256 SPKI
// header. Mirrors the byte-scan approach used by Ox's WebAuthn fallback.
//
// CBOR encoding reference:
//   0x21 = CBOR negative int -2 (COSE label for x coordinate)
//   0x22 = CBOR negative int -3 (COSE label for y coordinate)
//   0x58 = CBOR byte string with 1-byte length prefix
//   0x20 = 32 (coordinate byte length for P-256)
private let p256CoordinateLength: Int = 0x20
private let cborByteString1ByteLen: UInt8 = 0x58
private let coseXLabel: UInt8 = 0x21
private let coseYLabel: UInt8 = 0x22

private let spkiP256Header: [UInt8] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
]

private func extractSpkiFromAttestation(_ data: Data) -> Data? {
    guard data.count >= 3 + p256CoordinateLength else { return nil }
    guard
        let x = findCoseCoordinate(in: data, label: coseXLabel),
        let y = findCoseCoordinate(in: data, label: coseYLabel)
    else { return nil }

    var spki = Data(capacity: spkiP256Header.count + 1 + p256CoordinateLength * 2)
    spki.append(contentsOf: spkiP256Header)
    spki.append(0x04) // uncompressed point indicator
    spki.append(x)
    spki.append(y)
    return spki
}

private func findCoseCoordinate(in data: Data, label: UInt8) -> Data? {
    let coordLen = p256CoordinateLength
    let upperBound = data.count - 3 - coordLen
    guard upperBound >= 0 else { return nil }
    for i in 0...upperBound {
        if data[i] == label
            && data[i + 1] == cborByteString1ByteLen
            && data[i + 2] == UInt8(coordLen)
        {
            return data.subdata(in: (i + 3)..<(i + 3 + coordLen))
        }
    }
    return nil
}

// MARK: - Base64URL encoding/decoding for Data

private extension Data {
    init?(base64URLEncoded string: String) {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 {
            base64.append("=")
        }
        self.init(base64Encoded: base64)
    }

    func base64URLEncodedString() -> String {
        return self.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

@_cdecl("init_plugin_frak_webauthn")
func initPlugin() -> Plugin {
    return FrakWebauthnPlugin()
}
