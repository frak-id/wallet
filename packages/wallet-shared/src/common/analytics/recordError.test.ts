import { EdenFetchError } from "@elysiajs/eden";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordError } from "./recordError";

const { mockTrackEvent, mockCrashlyticsRecord } = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockCrashlyticsRecord: vi.fn(),
}));

vi.mock("./trackEvent", () => ({ trackEvent: mockTrackEvent }));
vi.mock("./crashlytics", () => ({
    crashlytics: { recordError: mockCrashlyticsRecord },
}));
vi.mock("./openpanel", () => ({
    getPlatformInfo: () => ({ isTauri: false, platform: "web" }),
}));

function lastPayload() {
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    const [event, payload] = mockTrackEvent.mock.calls[0];
    expect(event).toBe("app_error");
    return payload;
}

describe("recordError", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("reports the backend message, code and status for a JSON error body", () => {
        const body = {
            success: false,
            code: "PROOF_INVALID",
            error: "Proof rejected",
        };
        recordError(new EdenFetchError(403, body), { source: "manual" });

        const payload = lastPayload();
        expect(payload.message).toBe("Proof rejected");
        expect(payload.error_code).toBe("PROOF_INVALID");
        expect(payload.http_status).toBe(403);
        expect(JSON.stringify(payload)).not.toContain("[object Object]");
    });

    it("falls back to the code when the body has no error text", () => {
        recordError(new EdenFetchError(400, { code: "ONLY_CODE" }));

        const payload = lastPayload();
        expect(payload.message).toBe("ONLY_CODE");
        expect(payload.error_code).toBe("ONLY_CODE");
    });

    it("never reports the rejected input from a validation body", () => {
        const body = {
            type: "validation",
            on: "body",
            found: { iban: "FR7630006000011234567890189" },
        };
        recordError(new EdenFetchError(422, body));

        const payload = lastPayload();
        expect(payload.message).toBe("HTTP 422");
        expect(payload.http_status).toBe(422);
        expect(JSON.stringify(payload)).not.toContain(
            "FR7630006000011234567890189"
        );
        expect(mockCrashlyticsRecord.mock.calls[0][0].message).toBe("HTTP 422");
    });

    it("hands Crashlytics the same readable message", () => {
        recordError(new EdenFetchError(403, { error: "Proof rejected" }));

        expect(mockCrashlyticsRecord.mock.calls[0][0].message).toBe(
            "Proof rejected"
        );
    });

    it("keeps a text body message and adds the status", () => {
        recordError(new EdenFetchError(429, "Too Many Requests"));

        const payload = lastPayload();
        expect(payload.message).toBe("Too Many Requests");
        expect(payload.http_status).toBe(429);
        expect(payload).not.toHaveProperty("error_code");
    });

    it("leaves a plain Error unchanged without http_status", () => {
        recordError(new Error("boom"));

        const payload = lastPayload();
        expect(payload.message).toBe("boom");
        expect(payload).not.toHaveProperty("http_status");
        expect(payload).not.toHaveProperty("error_code");
    });
});
