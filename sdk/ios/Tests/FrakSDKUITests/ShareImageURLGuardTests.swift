import Foundation
import Testing

@testable import FrakSDKUI

/// `isFetchableShareImageURL` re-validates a `shareImage` independently of the hosted page's own
/// https-only check: this SDK is the one that fetches the URL, so a scheme downgrade or a request
/// aimed at the app's own private network is this layer's problem, not the page's.
@Suite("isFetchableShareImageURL")
struct ShareImageURLGuardTests {
    @Test("a well-formed https url on a public host is fetchable")
    func httpsPublicHostIsFetchable() {
        #expect(isFetchableShareImageURL(URL(string: "https://cdn.example.com/logo.png")!))
    }

    @Test("http is rejected outright")
    func httpIsRejected() {
        #expect(!isFetchableShareImageURL(URL(string: "http://cdn.example.com/logo.png")!))
    }

    @Test("a non-network scheme is rejected")
    func nonNetworkSchemeIsRejected() {
        #expect(!isFetchableShareImageURL(URL(string: "file:///etc/passwd")!))
    }

    @Test("a bare-IP-literal host with no scheme match still requires https")
    func requiresHTTPSRegardlessOfHostShape() {
        #expect(!isFetchableShareImageURL(URL(string: "ftp://93.184.216.34/logo.png")!))
    }

    // MARK: - SSRF: private and link-local targets

    @Test("RFC 1918 private ranges are rejected")
    func privateRangesAreRejected() {
        for host in ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1"] {
            #expect(!isFetchableShareImageURL(URL(string: "https://\(host)/x.png")!), "expected \(host) rejected")
        }
    }

    @Test("link-local (169.254.0.0/16) is rejected")
    func linkLocalIsRejected() {
        #expect(!isFetchableShareImageURL(URL(string: "https://169.254.169.254/x.png")!))
    }

    @Test("loopback is rejected")
    func loopbackIsRejected() {
        #expect(!isFetchableShareImageURL(URL(string: "https://127.0.0.1/x.png")!))
    }

    @Test(".local mDNS hosts are rejected")
    func dotLocalIsRejected() {
        #expect(!isFetchableShareImageURL(URL(string: "https://printer.local/x.png")!))
    }

    @Test("a public IP that merely resembles a private one at a boundary octet is not rejected")
    func boundaryOctetsOutsideThePrivateRangeAreAllowed() {
        // 172.15.x and 172.32.x sit just outside the 172.16/12 block.
        #expect(isFetchableShareImageURL(URL(string: "https://172.15.0.1/x.png")!))
        #expect(isFetchableShareImageURL(URL(string: "https://172.32.0.1/x.png")!))
        #expect(isFetchableShareImageURL(URL(string: "https://11.0.0.1/x.png")!))
    }

    @Test("a public hostname is fetchable even though it is not an IP literal at all")
    func publicHostnameIsFetchable() {
        #expect(isFetchableShareImageURL(URL(string: "https://images.frak.id/logo.png")!))
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
    func privateLiteralsRejected() {
        for host in ["[::1]", "[fc00::1]", "[fd12:3456::1]", "[fe80::1]", "[febf::1]"] {
            #expect(isFetchableShareImageURL(URL(string: "https://\(host)/p.png")!) == false, "\(host)")
        }
    }

    @Test("an IPv4-mapped private address is rejected through its embedded address")
    func mappedPrivateRejected() {
        #expect(isFetchableShareImageURL(URL(string: "https://[::ffff:192.168.1.1]/p.png")!) == false)
    }

    @Test("a public IPv6 literal is still fetchable")
    func publicLiteralAllowed() {
        #expect(isFetchableShareImageURL(URL(string: "https://[2606:4700::1111]/p.png")!) == true)
    }
}
