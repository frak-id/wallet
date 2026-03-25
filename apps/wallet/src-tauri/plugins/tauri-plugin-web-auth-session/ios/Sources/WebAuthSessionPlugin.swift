import AuthenticationServices
import SwiftRs
import Tauri
import UIKit

class StartWebAuthSessionArgs: Decodable {
    let url: String
    let callbackScheme: String
}

class WebAuthSessionPlugin: Plugin {
    // Strong reference required — session is silently cancelled if deallocated
    private var authSession: ASWebAuthenticationSession?

    @objc public func startWebAuthSession(_ invoke: Invoke) {
        guard let args = try? invoke.parseArgs(StartWebAuthSessionArgs.self) else {
            invoke.reject("Invalid arguments: expected 'url' (string) and 'callbackScheme' (string)")
            return
        }

        guard let url = URL(string: args.url) else {
            invoke.reject("Invalid URL: \(args.url)")
            return
        }

        let callbackScheme = args.callbackScheme

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                invoke.reject("Plugin was deallocated")
                return
            }

            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                self?.authSession = nil

                if let error = error as? ASWebAuthenticationSessionError {
                    if error.code == .canceledLogin {
                        invoke.reject("cancelled")
                        return
                    }
                    invoke.reject("Authentication failed: \(error.localizedDescription)")
                    return
                }

                if let error = error {
                    invoke.reject("Session error: \(error.localizedDescription)")
                    return
                }

                guard let callbackURL = callbackURL else {
                    invoke.reject("No callback URL received")
                    return
                }

                invoke.resolve(["callbackUrl": callbackURL.absoluteString])
            }

            // Critical: share Safari localStorage (not ephemeral)
            // This allows the connect page to read data stored by the install page
            session.prefersEphemeralWebBrowserSession = false

            if #available(iOS 13.0, *) {
                session.presentationContextProvider = self
            }

            self.authSession = session

            if !session.start() {
                self.authSession = nil
                invoke.reject("Failed to start authentication session")
            }
        }
    }
}

// MARK: - Plugin initialization

@_cdecl("init_plugin_web_auth_session")
func initPlugin() -> Plugin {
    return WebAuthSessionPlugin()
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension WebAuthSessionPlugin: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Tauri's PluginManager holds the VC hosting the WKWebView — always prefer this
        if let window = manager.viewController?.view.window {
            return window
        }

        if let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
           let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
            return window
        }

        // Never return a bare UIWindow() — it has no scene/rootVC and crashes start()
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first ?? ASPresentationAnchor()
    }
}
