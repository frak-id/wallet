#if canImport(UIKit)
    import Foundation
    import UIKit

    /// Fetches the share sheet's preview image, validated as a decodable image but handed back
    /// as `Data` — not the `NSItemProvider` the caller ultimately needs — because `NSItemProvider`
    /// has no `Sendable` conformance under Swift 6 and so cannot cross into `SharingImagePreviewCache`'s
    /// actor isolation or a `Task`'s result type. `NativeShare.share`, on the main actor, is where
    /// `UIImage(data:)`/`NSItemProvider(object:)` run.
    ///
    /// Sender-side chrome only — nothing here reaches the recipient — so every failure mode is
    /// "no image", never an error the caller has to handle.
    ///
    /// A dedicated fetcher rather than `HTTPClient`: that type is JSON-shaped and scoped to the
    /// SDK's own `baseURL`, where this fetches an arbitrary merchant- or page-supplied URL and so
    /// needs its own SSRF guard.
    enum SharingImagePreview {
        static let timeoutSeconds: TimeInterval = 2
        static let maxBytes = 2 * 1024 * 1024
        /// The tap path's budget, well under `timeoutSeconds`: `NativeShare.share` blocks the
        /// chooser's appearance on this, where `warm()`'s prefetch has no deadline pressure at all.
        static let tapDeadlineSeconds: TimeInterval = 0.3

        /// nil on any failure: unreachable host, private/link-local target, oversized or
        /// non-image response, or a body `UIImage` refuses to decode.
        static func fetch(_ url: URL) async -> Data? {
            guard isFetchableShareImageURL(url) else { return nil }

            let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSeconds)
            // No-redirect: a public host redirecting to a private one would otherwise slip past
            // the `isFetchable` check above, which only ever sees the URL this SDK was handed.
            let session = URLSession(configuration: .ephemeral, delegate: NoRedirectDelegate(), delegateQueue: nil)

            let body: Data?
            do {
                body = try await withTimeout(timeoutSeconds) {
                    // Streamed, not `data(for:)`: that buffers the whole body before anyone can
                    // check its size, so a fast host can deliver hundreds of megabytes inside the
                    // timeout. `maxBytes` has to bound what is read, not what was already read.
                    let (stream, response) = try await session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse,
                        http.isSuccess,
                        isImageContentType(http.value(forHTTPHeaderField: "Content-Type"))
                    else { return nil }

                    var data = Data()
                    data.reserveCapacity(min(maxBytes, max(Int(http.expectedContentLength), 0)))
                    for try await byte in stream {
                        data.append(byte)
                        if data.count > maxBytes { return nil }
                    }
                    return data
                }
            } catch {
                return nil
            }
            guard let data = body, UIImage(data: data) != nil else { return nil }

            return data
        }

        private static func isImageContentType(_ value: String?) -> Bool {
            guard let value else { return false }
            let mediaType = value.split(separator: ";").first.map(String.init) ?? value
            return mediaType.trimmingCharacters(in: .whitespaces).lowercased().hasPrefix("image/")
        }

        /// `URLRequest.timeoutInterval` alone only bounds the initial connection, not a slow body
        /// transfer, so the deadline is enforced again here around the whole request.
        private static func withTimeout<T: Sendable>(
            _ seconds: TimeInterval,
            _ body: @escaping @Sendable () async throws -> T
        ) async throws -> T {
            try await withThrowingTaskGroup(of: T.self) { group in
                group.addTask { try await body() }
                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                    throw CancellationError()
                }
                defer { group.cancelAll() }
                guard let first = try await group.next() else { throw CancellationError() }
                return first
            }
        }
    }

    extension HTTPURLResponse {
        fileprivate var isSuccess: Bool { (200..<300).contains(statusCode) }
    }

    private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            willPerformHTTPRedirection response: HTTPURLResponse,
            newRequest request: URLRequest
        ) async -> URLRequest? {
            nil
        }
    }

    /// One in-flight/completed fetch per URL, so `warm()`'s prefetch and a tap landing before it
    /// finishes await the same request instead of issuing two. Holds `Data`, not `NSItemProvider`
    /// — see `SharingImagePreview.fetch`'s doc for why. Not a general cache: nothing ever evicts an
    /// entry, which is fine for a sheet's lifetime — at most a handful of URLs (the merchant logo,
    /// a couple of product images) ever pass through one.
    actor SharingImagePreviewCache {
        private var entries: [URL: Task<Data?, Never>] = [:]

        /// Starts (or joins) the fetch without waiting for it. Called from `warm()`, which has no
        /// deadline to respect — the tap path is what `imageData(for:)` bounds.
        @discardableResult
        func prefetch(_ url: URL) -> Task<Data?, Never> {
            task(for: url)
        }

        /// The tap path: an already-finished prefetch resolves immediately; one still in flight,
        /// or a URL never warmed at all (a product image, known only at tap time), gets
        /// `tapDeadlineSeconds` rather than blocking the chooser behind a full fetch.
        ///
        /// A raced `Task.sleep` rather than `fetch.value` alone: cancelling `fetch` here would
        /// also cancel `warm()`'s own await on it, so the deadline has to live in a sibling task
        /// instead, and both sides write into a locked box since `Task.result` is not otherwise
        /// observable without consuming the (shared) task.
        func imageData(for url: URL) async -> Data? {
            let fetch = task(for: url)
            let winner = SharingRaceBox()
            return await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    let result = await fetch.value
                    winner.set(result)
                }
                group.addTask {
                    try? await Task.sleep(
                        nanoseconds: UInt64(SharingImagePreview.tapDeadlineSeconds * 1_000_000_000)
                    )
                    winner.set(nil)
                }
                await group.next()
                group.cancelAll()
                return winner.value
            }
        }

        private func task(for url: URL) -> Task<Data?, Never> {
            if let existing = entries[url] { return existing }
            let created = Task { await SharingImagePreview.fetch(url) }
            entries[url] = created
            return created
        }
    }

    /// First-write-wins holder for `SharingImagePreviewCache.imageData(for:)`'s race: whichever of
    /// the fetch or the deadline finishes first sets it, the other's write is a no-op. `@unchecked`
    /// for the same reason as `NativeShare.swift`'s `ResumeLatch`: every mutation is behind the lock.
    private final class SharingRaceBox: @unchecked Sendable {
        private let lock = NSLock()
        private var written = false
        private var stored: Data?

        func set(_ value: Data?) {
            lock.lock()
            defer { lock.unlock() }
            guard !written else { return }
            written = true
            stored = value
        }

        var value: Data? {
            lock.lock()
            defer { lock.unlock() }
            return stored
        }
    }
#endif
