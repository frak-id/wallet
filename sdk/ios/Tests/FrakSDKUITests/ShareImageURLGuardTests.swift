import Foundation
import Testing

@testable import FrakSDKUI

/// `URL(string:)` is optional and force-unwrapping is banned, so every literal goes through here.
private func url(_ value: String) throws -> URL {
    try #require(URL(string: value))
}

@Suite("isFetchableShareImageURL")
struct ShareImageURLGuardTests {
    @Test("a well-formed https url on a public host is fetchable")
    func httpsPublicHostIsFetchable() throws {
        #expect(isFetchableShareImageURL(try url("https://cdn.example.com/logo.png")))
    }

    @Test("http is rejected outright")
    func httpIsRejected() throws {
        #expect(!isFetchableShareImageURL(try url("http://cdn.example.com/logo.png")))
    }

    @Test("a non-network scheme is rejected")
    func nonNetworkSchemeIsRejected() throws {
        #expect(!isFetchableShareImageURL(try url("file:///etc/passwd")))
    }

    @Test("a bare-IP-literal host with no scheme match still requires https")
    func requiresHTTPSRegardlessOfHostShape() throws {
        #expect(!isFetchableShareImageURL(try url("ftp://93.184.216.34/logo.png")))
    }

    // MARK: - SSRF: private and link-local targets

    @Test("RFC 1918 private ranges are rejected")
    func privateRangesAreRejected() throws {
        for host in ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1"] {
            #expect(!isFetchableShareImageURL(try url("https://\(host)/x.png")), "expected \(host) rejected")
        }
    }

    @Test("link-local (169.254.0.0/16) is rejected")
    func linkLocalIsRejected() throws {
        #expect(!isFetchableShareImageURL(try url("https://169.254.169.254/x.png")))
    }

    @Test("loopback is rejected")
    func loopbackIsRejected() throws {
        #expect(!isFetchableShareImageURL(try url("https://127.0.0.1/x.png")))
    }

    @Test("internal-only name suffixes are rejected")
    func internalNameSuffixesAreRejected() throws {
        #expect(!isFetchableShareImageURL(try url("https://printer.local/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://localhost/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://api.localhost/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://svc.internal/x.png")))
        // The rule is a suffix, not a substring: this is an ordinary public name.
        #expect(isFetchableShareImageURL(try url("https://localhost.cdn.example.com/x.png")))
    }

    @Test("single-label hosts are rejected, since they resolve on the LAN")
    func singleLabelHostsAreRejected() throws {
        // This SDK performs the fetch, so a search-domain completion would reach the
        // user's own network from inside the merchant's app.
        #expect(!isFetchableShareImageURL(try url("https://router/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://intranet/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://printer.home.arpa/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://box.lan/x.png")))
        #expect(isFetchableShareImageURL(try url("https://cdn.example.com/x.png")))
    }

    @Test("0.0.0.0/8 is rejected, since Darwin routes it to loopback")
    func unspecifiedAddressIsRejected() throws {
        #expect(!isFetchableShareImageURL(try url("https://0.0.0.0/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://0.0.0.1/x.png")))
        #expect(!isFetchableShareImageURL(try url("https://[::ffff:0:1]/x.png")))
    }

    @Test("a public IP that merely resembles a private one at a boundary octet is not rejected")
    func boundaryOctetsOutsideThePrivateRangeAreAllowed() throws {
        // 172.15.x and 172.32.x sit just outside the 172.16/12 block.
        #expect(isFetchableShareImageURL(try url("https://172.15.0.1/x.png")))
        #expect(isFetchableShareImageURL(try url("https://172.32.0.1/x.png")))
        #expect(isFetchableShareImageURL(try url("https://11.0.0.1/x.png")))
    }

    @Test("a public hostname is fetchable even though it is not an IP literal at all")
    func publicHostnameIsFetchable() throws {
        #expect(isFetchableShareImageURL(try url("https://images.frak.id/logo.png")))
    }
}

@Suite("IPv4Address")
struct IPv4AddressTests {
    @Test("parses four valid octets")
    func parsesValidOctets() {
        let address = IPv4Address("10.20.30.40")
        #expect(address?.octets.0 == 10)
        #expect(address?.octets.1 == 20)
        #expect(address?.octets.2 == 30)
        #expect(address?.octets.3 == 40)
    }

    @Test("a non-IPv4 hostname does not parse")
    func nonIPv4HostnameDoesNotParse() {
        #expect(IPv4Address("images.frak.id") == nil)
    }

    @Test("an out-of-range octet does not parse")
    func outOfRangeOctetDoesNotParse() {
        #expect(IPv4Address("999.1.1.1") == nil)
    }

    @Test("the wrong number of components does not parse")
    func wrongComponentCountDoesNotParse() {
        #expect(IPv4Address("1.2.3") == nil)
        #expect(IPv4Address("1.2.3.4.5") == nil)
    }
}

@Suite("isFetchableShareImageURL — IPv6 literals")
struct ShareImageIPv6GuardTests {
    @Test("loopback, unique-local and link-local literals are rejected")
    func privateLiteralsRejected() throws {
        for host in ["[::1]", "[fc00::1]", "[fd12:3456::1]", "[fe80::1]", "[febf::1]"] {
            #expect(isFetchableShareImageURL(try url("https://\(host)/p.png")) == false, "\(host)")
        }
    }

    @Test("an IPv4-mapped private address is rejected through its embedded address")
    func mappedPrivateRejected() throws {
        #expect(isFetchableShareImageURL(try url("https://[::ffff:192.168.1.1]/p.png")) == false)
        // `URL` may normalise the embedded address to hex.
        #expect(isFetchableShareImageURL(try url("https://[::ffff:a00:1]/p.png")) == false)
        #expect(isFetchableShareImageURL(try url("https://[::ffff:c0a8:1]/p.png")) == false)
        #expect(isFetchableShareImageURL(try url("https://[::ffff:808:808]/p.png")) == true)
    }

    @Test("a public IPv6 literal is still fetchable")
    func publicLiteralAllowed() throws {
        #expect(isFetchableShareImageURL(try url("https://[2606:4700::1111]/p.png")) == true)
    }
}
