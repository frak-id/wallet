import Foundation
import Testing

@testable import FrakSDK

@Suite("GoldenSharingLinks")
struct GoldenSharingLinksTests {
    struct DecodedLink: Equatable {
        let base: String
        let query: [[String]]
        let fragment: String
    }

    private static func entries(of kind: String) throws -> [[String: Any]] {
        try GoldenFixtures.load(GoldenFixtures.sharingLinks).entries.filter { $0["kind"] as? String == kind }
    }

    private static func string(_ object: [String: Any], _ key: String) -> String? {
        object[key] as? String
    }

    static func decodeLink(_ link: String) -> DecodedLink {
        let hash = link.firstIndex(of: "#")
        let fragment = hash.map { String(link[$0...]) } ?? ""
        let beforeFragment = hash.map { String(link[..<$0]) } ?? link

        let mark = beforeFragment.firstIndex(of: "?")
        let head = mark.map { String(beforeFragment[..<$0]) } ?? beforeFragment
        let queryString = mark.map { String(beforeFragment[beforeFragment.index(after: $0)...]) } ?? ""

        let authorityStart = head.range(of: "://")?.upperBound ?? head.startIndex
        let pathStart = head[authorityStart...].firstIndex(of: "/")
        let origin = pathStart.map { String(head[..<$0]) } ?? head
        let path = pathStart.map { String(head[$0...]) } ?? "/"

        let query = queryString.split(separator: "&", omittingEmptySubsequences: true).map { segment -> [String] in
            guard let equals = segment.firstIndex(of: "=") else {
                return [URLQuery.percentDecode(String(segment)), ""]
            }
            return [
                URLQuery.percentDecode(String(segment[..<equals])),
                URLQuery.percentDecode(String(segment[segment.index(after: equals)...])),
            ]
        }
        return DecodedLink(base: origin.lowercased() + path, query: query, fragment: fragment)
    }

    private static func expectedLink(_ expected: Any?) throws -> DecodedLink? {
        guard let object = expected as? [String: Any] else { return nil }
        guard let base = string(object, "base"), let query = object["query"] as? [[String]],
            let fragment = string(object, "fragment")
        else {
            throw GoldenFixtures.CorpusError(description: "malformed decoded link: \(object)")
        }
        return DecodedLink(base: base, query: query, fragment: fragment)
    }

    private static func contextOf(_ object: [String: Any]) throws -> FrakContext.V2 {
        guard let merchantId = string(object, "m"), let timestamp = object["t"] as? Int else {
            throw GoldenFixtures.CorpusError(description: "context has no m/t: \(object)")
        }
        return FrakContext.V2(
            merchantId: merchantId,
            timestamp: Int64(timestamp),
            clientId: string(object, "c"),
            wallet: string(object, "w")
        )
    }

    private static func attribution(_ object: [String: Any]?) -> AttributionParams? {
        object.map {
            AttributionParams(
                utmSource: string($0, "utmSource"),
                utmMedium: string($0, "utmMedium"),
                utmCampaign: string($0, "utmCampaign"),
                utmContent: string($0, "utmContent"),
                utmTerm: string($0, "utmTerm"),
                via: string($0, "via"),
                ref: string($0, "ref")
            )
        }
    }

    private static func defaults(_ object: [String: Any]?) -> AttributionDefaults? {
        object.map {
            AttributionDefaults(
                utmSource: string($0, "utmSource"),
                utmMedium: string($0, "utmMedium"),
                utmCampaign: string($0, "utmCampaign"),
                utmTerm: string($0, "utmTerm"),
                via: string($0, "via"),
                ref: string($0, "ref")
            )
        }
    }

    @Test("builds every fixture to the expected decoded link")
    func buildsEveryFixture() throws {
        let fixtures = try Self.entries(of: "build")
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let name = try #require(Self.string(fixture, "name"))
            let input = try #require(fixture["input"] as? [String: Any])
            let baseURL = try #require(Self.string(input, "baseUrl"))
            let context = try #require(input["context"] as? [String: Any])
            let link = SharingLinkBuilder.build(
                baseURL: baseURL,
                context: try Self.contextOf(context),
                attribution: Self.attribution(input["perCall"] as? [String: Any]),
                defaults: Self.defaults(input["defaults"] as? [String: Any]),
                productUtmContent: Self.string(input, "productUtmContent")
            )
            #expect(link.map(Self.decodeLink) == (try Self.expectedLink(fixture["expected"])), "\(name)")
        }
    }

    @Test("parses every fixture to the expected context")
    func parsesEveryFixture() throws {
        let fixtures = try Self.entries(of: "parse")
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let name = try #require(Self.string(fixture, "name"))
            let input = try #require(fixture["input"] as? [String: Any])
            let url = try #require(Self.string(input, "url"))
            let expected = try (fixture["expected"] as? [String: Any]).map { FrakContext.v2(try Self.contextOf($0)) }
            #expect(SharingLinkBuilder.parse(url) == expected, "\(name)")
        }
    }

    @Test("decodes a link by lowercasing the origin and splitting on the first equals")
    func decodesALink() {
        #expect(
            Self.decodeLink("HTTPS://Shop.Example?k=a=b&n=x+y%2Bz&flag&&#top")
                == DecodedLink(
                    base: "https://shop.example/",
                    query: [["k", "a=b"], ["n", "x y+z"], ["flag", ""]],
                    fragment: "#top"
                )
        )
    }
}
