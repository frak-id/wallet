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
        pendingInvoke?.reject(error.localizedDescription)
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

        let responseObj: JsonObject = [
            "clientDataJSON": credential.rawClientDataJSON.base64URLEncodedString(),
            "attestationObject": (credential.rawAttestationObject ?? Data()).base64URLEncodedString(),
            "transports": ["internal"] as [String],
            "publicKeyAlgorithm": -7,
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
