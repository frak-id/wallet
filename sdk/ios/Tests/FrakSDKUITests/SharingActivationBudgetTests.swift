import Testing

@testable import FrakSDKUI

@Suite("sharingActivationBudget")
struct SharingActivationBudgetTests {
    @Test("a document with no known finish time gets the fast-path second")
    func unknownAge() {
        #expect(sharingActivationBudget(warmDocumentAge: nil, boot: 3) == sharingActivationDeadline)
    }

    @Test("a document that just finished gets the whole boot budget")
    func justFinished() {
        #expect(sharingActivationBudget(warmDocumentAge: 0, boot: 3) == 3)
    }

    @Test("a document still booting gets what is left of the boot budget")
    func stillBooting() {
        #expect(sharingActivationBudget(warmDocumentAge: 1, boot: 3) == 2)
    }

    @Test("a booted document never gets less than the fast-path second")
    func booted() {
        #expect(sharingActivationBudget(warmDocumentAge: 2.5, boot: 3) == sharingActivationDeadline)
        #expect(sharingActivationBudget(warmDocumentAge: 600, boot: 3) == sharingActivationDeadline)
    }

    @Test("a clock that jumped back never stretches the budget past boot")
    func clockJumpedBack() {
        #expect(sharingActivationBudget(warmDocumentAge: -60, boot: 3) == 3)
    }

}
