import CryptoKit
import Foundation

/// Inbound `?fmt=` handling: this install is the merge *target*, folding its anonymous id into the
/// group the token names. Owns token parsing, the wire-body shape and the same-process claim; the
/// post itself runs through `MergeSender` off the durable queue.
actor IdentityMerge {
    static let tokenKey = "fmt"
    static let executePath = "/user/identity/merge/execute"

    private let logger: FrakLogger
    private var consumed: Set<String> = []
    private var arrivals: Set<String> = []

    init(logger: FrakLogger) {
        self.logger = logger
    }

    static func parseToken(_ url: String) -> String? {
        URLQuery.parse(url)?.value(for: tokenKey).flatMap { $0.isEmpty ? nil : $0 }
    }

    /// The bytes a merge proof signs over. Shared with `MergeSender` so the queued wire post and
    /// the enclave binding never drift on what is being attested to.
    static func binding(_ mergeToken: String) -> Data {
        Data(SHA256.hash(data: Data(mergeToken.utf8)))
    }

    /// The wire body for `executePath`. Nil only if `JSONSerialization` itself fails, which none
    /// of these plain-string fields can trigger in practice.
    static func body(mergeToken: String, anonymousId: String, merchantId: String, proof: String) -> Data? {
        let payload: [String: String] = [
            "mergeToken": mergeToken,
            "targetAnonymousId": anonymousId,
            "merchantId": merchantId,
            "proof": proof,
        ]
        return try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
    }

    /// Burns a merge token once. In-memory only — `EventOutbox.isQueued` survives a restart, this
    /// closes the race two same-process `handleReferralLink` calls win against a disk check.
    func claim(_ mergeToken: String) -> Bool {
        !mergeToken.isEmpty && consumed.insert(mergeToken).inserted
    }

    /// The arrival half of `claim`: SwiftUI delivers `.onOpenURL` to every view registering the
    /// modifier, so one tap reaches here many times and each would track its own arrival.
    func claimArrival(_ context: String) -> Bool {
        !context.isEmpty && arrivals.insert(context).inserted
    }
}
