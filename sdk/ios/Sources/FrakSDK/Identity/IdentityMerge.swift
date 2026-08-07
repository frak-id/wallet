import CryptoKit
import Foundation

/// Inbound `?fmt=` handling: this install is the merge *target*, folding its anonymous id into the
/// group the token names. Mirrors the web SDK's handling in `createIFrameFrakClient.ts`, except
/// there the listener posts and here the SDK does.
///
/// The outbound half (`/merge/initiate`) has no native caller.
actor IdentityMerge {
    static let tokenKey = "fmt"
    static let executePath = "/user/identity/merge/execute"

    private let http: HTTPClient
    private let identity: AnonymousIdStore
    private let logger: FrakLogger
    private var consumed: Set<String> = []

    init(http: HTTPClient, identity: AnonymousIdStore, logger: FrakLogger) {
        self.http = http
        self.identity = identity
        self.logger = logger
    }

    static func parseToken(_ url: String) -> String? {
        URLQuery.parse(url)?.value(for: tokenKey).flatMap { $0.isEmpty ? nil : $0 }
    }

    /// Never throws: this runs off a merchant's deep-link callback. Returns whether the backend
    /// accepted the merge.
    ///
    /// A proof is mandatory, unlike the web arm that must keep working for keyless legacy ids: a
    /// native id that cannot sign is one the backend is expected to start refusing (see ROLLOUT.md).
    @discardableResult
    func execute(mergeToken: String, merchantId: String, anonymousId: String) async -> Bool {
        // A merchant's router hands the same URL back on every reactivation; each is not a merge.
        guard !mergeToken.isEmpty, consumed.insert(mergeToken).inserted else { return false }

        let binding = Data(SHA256.hash(data: Data(mergeToken.utf8)))
        guard let proof = await identity.signProof(.merge, merchantId: merchantId, binding: binding) else {
            logger.warn("Could not sign the merge proof; skipping the identity merge.")
            return false
        }

        let payload = [
            "mergeToken": mergeToken,
            "targetAnonymousId": anonymousId,
            "merchantId": merchantId,
            "proof": proof,
        ]
        guard let body = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else {
            logger.warn("Could not encode the identity merge body.")
            return false
        }

        do {
            let response = try await http.post(Self.executePath, body: body)
            guard response.isSuccess else {
                logger.warn("Identity merge refused with status \(response.status).")
                return false
            }
            return true
        } catch is CancellationError {
            return false
        } catch {
            logger.warn("Identity merge could not reach the backend", error)
            return false
        }
    }
}
