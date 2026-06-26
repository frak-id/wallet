import { describe, expect, it } from "vitest";
import { getRequestId } from "./requestId";

function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com", { headers });
}

describe("getRequestId", () => {
    it("returns the Root segment from x-amzn-trace-id", () => {
        const req = makeRequest({
            "x-amzn-trace-id":
                "Root=1-67abc123-abcdef012345678901234567;Parent=53995c3f42cd8ad8;Sampled=1",
        });
        expect(getRequestId(req)).toBe("1-67abc123-abcdef012345678901234567");
    });

    it("returns the full trace value when no Root= segment is present", () => {
        const req = makeRequest({
            "x-amzn-trace-id": "Self=1-abc;LambdaContext=xyz",
        });
        expect(getRequestId(req)).toBe("Self=1-abc;LambdaContext=xyz");
    });

    it("falls back to x-amz-cf-id when no trace header", () => {
        const req = makeRequest({
            "x-amz-cf-id": "ABCDEF1234567890==",
        });
        expect(getRequestId(req)).toBe("ABCDEF1234567890==");
    });

    it("returns undefined when neither header is present", () => {
        const req = makeRequest({});
        expect(getRequestId(req)).toBeUndefined();
    });

    it("falls back to cf-id when the trace header is empty", () => {
        const req = makeRequest({
            "x-amzn-trace-id": "",
            "x-amz-cf-id": "CF-EMPTY-TRACE",
        });
        expect(getRequestId(req)).toBe("CF-EMPTY-TRACE");
    });

    it("returns undefined for an empty-but-present cf-id", () => {
        const req = makeRequest({ "x-amz-cf-id": "" });
        expect(getRequestId(req)).toBeUndefined();
    });
});
