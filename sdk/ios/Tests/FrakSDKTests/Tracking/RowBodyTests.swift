import Foundation
import Testing

@testable import FrakSDK

@Suite("RowBody")
struct RowBodyTests {
    private static let merchantId = "550e8400-e29b-41d4-a716-446655440000"

    /// A direct body (merchantId present from the start) must be byte-identical to an
    /// injected one (merchantId added after the fact): this is the contract that makes the
    /// opaque-string payload safe.
    private func assertByteIdentical(withMerchantId direct: [String: Any], without payload: [String: Any]) throws {
        let directData = try #require(
            try? JSONSerialization.data(withJSONObject: direct, options: [.sortedKeys])
        )
        let payloadData = try #require(
            try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
        )
        let injected = try #require(
            RowBody.withMerchantId(String(decoding: payloadData, as: UTF8.self), merchantId: Self.merchantId)
        )
        #expect(injected.data == directData)
    }

    @Test("arrival: injected body matches one built with merchantId from the start")
    func arrivalByteIdentical() throws {
        try assertByteIdentical(
            withMerchantId: [
                "type": "arrival",
                "merchantId": Self.merchantId,
                "referrerWallet": "0xabc",
            ],
            without: [
                "type": "arrival",
                "referrerWallet": "0xabc",
            ]
        )
    }

    @Test("sharing: injected body matches one built with merchantId from the start")
    func sharingByteIdentical() throws {
        try assertByteIdentical(
            withMerchantId: [
                "type": "sharing",
                "merchantId": Self.merchantId,
                "sharingTimestamp": 1_709_654_400,
            ],
            without: [
                "type": "sharing",
                "sharingTimestamp": 1_709_654_400,
            ]
        )
    }

    @Test("custom: injected body matches one built with merchantId from the start")
    func customByteIdentical() throws {
        try assertByteIdentical(
            withMerchantId: [
                "type": "custom",
                "merchantId": Self.merchantId,
                "customType": "foo",
                "data": ["a": "b"],
            ],
            without: [
                "type": "custom",
                "customType": "foo",
                "data": ["a": "b"],
            ]
        )
    }

    @Test("purchase: injected body matches one built with merchantId from the start")
    func purchaseByteIdentical() throws {
        try assertByteIdentical(
            withMerchantId: [
                "merchantId": Self.merchantId,
                "customerId": "cust-1",
                "orderId": "order-1",
                "token": "tok-1",
            ],
            without: [
                "customerId": "cust-1",
                "orderId": "order-1",
                "token": "tok-1",
            ]
        )
    }

    @Test("nil when the payload is not valid JSON")
    func nilOnUnparseablePayload() {
        #expect(RowBody.withMerchantId("not json", merchantId: Self.merchantId) == nil)
    }

    @Test("the parsed fields carry the injected merchantId")
    func fieldsCarryMerchantId() throws {
        let built = try #require(RowBody.withMerchantId(#"{"type":"sharing"}"#, merchantId: Self.merchantId))
        #expect(built.fields["merchantId"] as? String == Self.merchantId)
        #expect(built.fields["type"] as? String == "sharing")
    }
}
