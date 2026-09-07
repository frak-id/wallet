import Testing

@_spi(FrakInternal) @testable import FrakSDK

@Suite("FrakSDKVersion")
struct FrakSDKVersionTests {
    @Test("version is not empty")
    func versionIsNotEmpty() {
        #expect(!FrakSDKVersion.current.isEmpty)
    }

    @Test("version is semver with an optional prerelease, safe to put in a URL and a header")
    func versionIsSemverAndTransportSafe() {
        // The accepted shape is the tag gate in .github/workflows/release-ios-sdk.yml; a version
        // this rejects cannot be released, and one it accepts must survive both transports.
        let parts = FrakSDKVersion.current.split(separator: "-", maxSplits: 1)
        let core = parts[0].split(separator: ".")
        #expect(core.count == 3)
        for component in core {
            let isNumeric = component.allSatisfy(\.isNumber)
            #expect(isNumeric, "unexpected component: \(component)")
        }
        if parts.count == 2 {
            let prerelease = parts[1]
            let isAlphanumericDotted = prerelease.allSatisfy {
                $0.isASCII && ($0.isLetter || $0.isNumber || $0 == ".")
            }
            #expect(!prerelease.isEmpty)
            #expect(isAlphanumericDotted, "unexpected prerelease: \(prerelease)")
        }
        #expect(
            FrakSDKVersion.current.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
                == FrakSDKVersion.current
        )
    }

    @Test("transport names are stable")
    func transportNamesAreStable() {
        #expect(FrakSDKVersion.headerName == "x-frak-sdk-version")
        #expect(FrakSDKVersion.queryParameterName == "sdkVersion")
    }
}
