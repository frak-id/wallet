import Testing

@testable import FrakSDKUI

@Suite("sharingExitEndsSession")
struct SharingSheetExitTests {
    @Test("a late onDismiss from the previous sheet spares a session whose sheet has not appeared")
    func lateDismissSparesUnpresented() {
        #expect(!sharingExitEndsSession(.sheetDismissed, wasPresented: false))
    }

    @Test("onDismiss ends a session whose sheet appeared")
    func dismissEndsPresented() {
        #expect(sharingExitEndsSession(.sheetDismissed, wasPresented: true))
    }

    @Test("a cleared binding ends only a session that never got a sheet")
    func bindingClearedEndsUnpresentedOnly() {
        #expect(sharingExitEndsSession(.bindingCleared, wasPresented: false))
        #expect(!sharingExitEndsSession(.bindingCleared, wasPresented: true))
    }

    @Test("every session is ended by exactly one of the two signals a dismissal fires")
    func exactlyOneSignalEndsEachSession() {
        for wasPresented in [false, true] {
            let enders = [SharingSheetExit.bindingCleared, .sheetDismissed].filter {
                sharingExitEndsSession($0, wasPresented: wasPresented)
            }
            #expect(enders.count == 1)
        }
    }

    @Test("the surface leaving ends the session either way")
    func unconditionalAlwaysEnds() {
        #expect(sharingExitEndsSession(.unconditional, wasPresented: false))
        #expect(sharingExitEndsSession(.unconditional, wasPresented: true))
    }
}
