import Testing

@_spi(FrakInternal) @testable import FrakSDK

@Suite("QueriedSchemes")
struct QueriedSchemesTests {
    @Test("declares answers true for an exact match")
    func declaresExactMatch() {
        #expect(QueriedSchemes.declares("frakwallet", in: ["frakwallet"]))
    }

    @Test("declares is case-insensitive, like the scheme comparison itself")
    func declaresCaseInsensitive() {
        #expect(QueriedSchemes.declares("frakwallet", in: ["FrakWallet"]))
        #expect(QueriedSchemes.declares("FRAKWALLET", in: ["frakwallet"]))
    }

    @Test("the dev and prod wallet schemes do not satisfy each other — the trap this type exists to catch")
    func devAndProdSchemesAreDistinct() {
        #expect(!QueriedSchemes.declares("frakwallet-dev", in: ["frakwallet"]))
        #expect(!QueriedSchemes.declares("frakwallet", in: ["frakwallet-dev"]))
    }

    @Test("status is undeclared on a missing key, modelled as an empty array")
    func statusUndeclaredOnMissingKey() {
        #expect(QueriedSchemes.status(for: "frakwallet", declared: []) == .undeclared)
    }

    @Test("status is ok when the scheme is present among others")
    func statusOkAmongOthers() {
        #expect(
            QueriedSchemes.status(for: "frakwallet", declared: ["instagram", "frakwallet", "googledrive"])
                == .ok
        )
    }

    @Test("isAtCap is exact at the boundary, not off by one")
    func isAtCapBoundary() {
        let underCap = Array(repeating: "scheme", count: QueriedSchemes.cap - 1)
        let atCap = Array(repeating: "scheme", count: QueriedSchemes.cap)
        #expect(!QueriedSchemes.isAtCap(underCap))
        #expect(QueriedSchemes.isAtCap(atCap))
    }
}
