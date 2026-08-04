import Testing

@testable import FrakSDK

@Suite("FrakSDKVersion")
struct FrakSDKVersionTests {
    @Test("version is not empty")
    func versionIsNotEmpty() {
        #expect(!FrakSDKVersion.current.isEmpty)
    }

    /// `?sdkv=` and `x-frak-sdk-version` carry this value verbatim, so a stray space or
    /// `v` prefix would reach the backend and the hosted page as-is.
    @Test("version is dotted numeric, safe to put in a URL and a header")
    func versionIsDottedNumeric() {
        let components = FrakSDKVersion.current.split(separator: ".")
        #expect(components.count == 3)
        for component in components {
            let isNumeric = component.allSatisfy(\.isNumber)
            #expect(isNumeric, "unexpected component: \(component)")
        }
    }

    @Test("transport names are stable")
    func transportNamesAreStable() {
        #expect(FrakSDKVersion.headerName == "x-frak-sdk-version")
        #expect(FrakSDKVersion.queryParameterName == "sdkv")
    }
}
