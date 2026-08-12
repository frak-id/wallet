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

        /// Retained for the process: a `URLSession` with a delegate keeps that delegate and its
        /// queue alive until it is invalidated, so building one per fetch leaks all three.
        private static let session = URLSession(
            configuration: .ephemeral,
            delegate: NoRedirectDelegate(),
            delegateQueue: nil
        )

        /// nil on any failure; the image is optional chrome.
        static func fetch(_ url: URL) async -> Data? {
            guard isFetchableShareImageURL(url) else { return nil }

            let request = URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: timeoutSeconds)

            let body: Data?
            do {
                body = try await withTimeout(timeoutSeconds) {
                    // Headers first, so an advertised over-cap body is refused before a byte of it
                    // is buffered; the running cap below is for a response that lies or omits it.
                    let (bytes, response) = try await session.bytes(for: request)
                    guard let http = response as? HTTPURLResponse,
                        http.isSuccess,
                        isImageContentType(http.value(forHTTPHeaderField: "Content-Type")),
                        http.expectedContentLength <= maxBytes
                    else { return nil }

                    var data = Data()
                    if http.expectedContentLength > 0 {
                        data.reserveCapacity(Int(http.expectedContentLength))
                    }
                    for try await byte in bytes {
                        data.append(byte)
                        if data.count > maxBytes { return nil }
                    }
                    return data
                }
            } catch {
                return nil
            }
            guard let data = body, !data.isEmpty else { return nil }

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

    /// One in-flight fetch per URL, so a prefetch and a tap landing mid-flight share it.
    actor SharingImagePreviewCache {
        private var entries: [URL: Task<Data?, Never>] = [:]

        /// Starts (or joins) the fetch without waiting.
        @discardableResult
        func prefetch(_ url: URL) -> Task<Data?, Never> {
            task(for: url)
        }

        /// Bounded by `tapDeadlineSeconds`.
        ///
        /// The two racers are unstructured tasks on purpose: a task group implicitly awaits its
        /// children on exit, and `Task.value` on a non-throwing task ignores cancellation, so a
        /// group here would wait out the whole fetch no matter what the deadline said.
        func imageData(for url: URL) async -> Data? {
            let fetch = task(for: url)
            let deadline = SharingImagePreview.tapDeadlineSeconds
            return await withCheckedContinuation { continuation in
                let latch = SharingRaceBox()
                // `Task.detached`, not `Task`: an actor-inheriting task would queue behind this
                // actor's own work, and the deadline has to tick independently of it.
                Task.detached {
                    let result = await fetch.value
                    if latch.claim() { continuation.resume(returning: result) }
                }
                Task.detached {
                    try? await Task.sleep(nanoseconds: UInt64(deadline * 1_000_000_000))
                    if latch.claim() { continuation.resume(returning: nil) }
                }
            }
        }

        private func task(for url: URL) -> Task<Data?, Never> {
            if let existing = entries[url] { return existing }
            let created = Task { await SharingImagePreview.fetch(url) }
            entries[url] = created
            Task.detached { [weak self] in await self?.forgetIfFailed(url, created) }
            return created
        }

        /// A failure is not cached: the prefetch runs at attach, the likeliest moment to be
        /// offline, and pinning nil there would mean no image for the rest of the process.
        private func forgetIfFailed(_ url: URL, _ task: Task<Data?, Never>) async {
            guard await task.value == nil else { return }
            if entries[url] == task { entries[url] = nil }
        }
    }

    /// First-claim-wins gate for the fetch/deadline race: exactly one of the two resumes the
    /// continuation, and resuming twice is a hard crash. `@unchecked` because the lock covers it.
    private final class SharingRaceBox: @unchecked Sendable {
        private let lock = NSLock()
        private var claimed = false

        func claim() -> Bool {
            lock.lock()
            defer { lock.unlock() }
            if claimed { return false }
            claimed = true
            return true
        }
    }
#endif
