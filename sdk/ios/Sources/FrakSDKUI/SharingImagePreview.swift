#if canImport(UIKit)
    import Foundation
    import UIKit

    /// Fetches the share sheet's preview image as `Data`: `NSItemProvider` is not `Sendable`, so
    /// the caller builds it on the main actor.
    enum SharingImagePreview {
        static let timeoutSeconds: TimeInterval = 2
        static let maxBytes = 2 * 1024 * 1024
        /// The tap path's budget: the chooser's appearance blocks on this.
        static let tapDeadlineSeconds: TimeInterval = 0.3

        /// nil on any failure; the image is optional chrome.
        static func fetch(_ url: URL) async -> Data? {
            guard isFetchableShareImageURL(url) else { return nil }

            let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSeconds)
            // No redirects: a public host could otherwise redirect to a private one.
            let session = URLSession(configuration: .ephemeral, delegate: NoRedirectDelegate(), delegateQueue: nil)

            let body: Data?
            do {
                body = try await withTimeout(timeoutSeconds) {
                    // Streamed: `maxBytes` must bound what is read, not what was already buffered.
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

        /// `timeoutInterval` bounds the connection only, not a slow body.
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

    /// One in-flight fetch per URL, so a prefetch and a tap landing mid-flight share it. Nothing
    /// evicts; a sheet only ever sees a handful of URLs.
    actor SharingImagePreviewCache {
        private var entries: [URL: Task<Data?, Never>] = [:]

        /// Starts (or joins) the fetch without waiting.
        @discardableResult
        func prefetch(_ url: URL) -> Task<Data?, Never> {
            task(for: url)
        }

        /// Bounded by `tapDeadlineSeconds`. The deadline races in a sibling task because
        /// cancelling the shared fetch here would cancel `warm()`'s await on it too.
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

    /// First-write-wins holder for the fetch/deadline race; `@unchecked` because every mutation
    /// is behind the lock.
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
