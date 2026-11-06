#if canImport(UIKit)
    import Foundation
    import Testing

    @testable import FrakSDKUI

    @Suite("ShareImageRedirectPolicy")
    struct ShareImageRedirectPolicyTests {
        private static func follow(_ from: String, to: String) async throws -> URL? {
            let source = try #require(URL(string: from))
            let target = try #require(URL(string: to))
            let response = try #require(
                HTTPURLResponse(url: source, statusCode: 302, httpVersion: nil, headerFields: ["Location": to])
            )
            let task = URLSession.shared.dataTask(with: source)
            defer { task.cancel() }
            return await ShareImageRedirectPolicy()
                .urlSession(
                    URLSession.shared,
                    task: task,
                    willPerformHTTPRedirection: response,
                    newRequest: URLRequest(url: target)
                )?
                .url
        }

        @Test("a redirect to a public https image is followed")
        func publicHTTPSIsFollowed() async throws {
            let target = "https://fastly.picsum.photos/id/594/1200/630.jpg"
            let followed = try await Self.follow("https://picsum.photos/seed/s/1200/630", to: target)
            #expect(followed?.absoluteString == target)
        }

        @Test(
            "a redirect the guard would refuse as a first URL is refused",
            arguments: [
                "http://cdn.example.com/a.jpg",
                "https://localhost/a.jpg",
                "https://10.0.0.1/a.jpg",
                "https://169.254.169.254/latest/meta-data",
                "https://[::1]/a.jpg",
                "https://router/a.jpg",
            ]
        )
        func unsafeHopIsRefused(target: String) async throws {
            #expect(try await Self.follow("https://cdn.example.com/a.jpg", to: target) == nil)
        }
    }
#endif
