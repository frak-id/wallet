import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startFlow } from "./startFlow";

const { mockTrack } = vi.hoisted(() => ({
    mockTrack: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./openpanel", () => ({
    openPanel: { track: mockTrack },
}));

describe("startFlow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe("creation", () => {
        it("emits {name}_started with a fresh flow_id and start extras", () => {
            const flow = startFlow("tokens_send", { prefill_address: true });
            expect(flow.flowId).toMatch(/.+/);
            expect(flow.flowName).toBe("tokens_send");
            expect(flow.ended).toBe(false);
            expect(mockTrack).toHaveBeenCalledWith("tokens_send_started", {
                flow_name: "tokens_send",
                flow_id: flow.flowId,
                prefill_address: true,
            });
        });

        it("generates unique flow_ids per instance", () => {
            const a = startFlow("tokens_send");
            const b = startFlow("tokens_send");
            expect(a.flowId).not.toBe(b.flowId);
        });

        it("emits the {name}_started variant for each declared flow", () => {
            mockTrack.mockClear();
            startFlow("auth_login", { method: "global" });
            expect(mockTrack).toHaveBeenLastCalledWith(
                "auth_login_started",
                expect.objectContaining({ method: "global" })
            );

            mockTrack.mockClear();
            startFlow("auth_register");
            expect(mockTrack).toHaveBeenLastCalledWith(
                "auth_register_started",
                expect.any(Object)
            );

            mockTrack.mockClear();
            startFlow("onboarding");
            expect(mockTrack).toHaveBeenLastCalledWith(
                "onboarding_started",
                expect.any(Object)
            );
        });
    });

    describe("track", () => {
        it("injects flow_id into scoped track calls", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            flow.track("tokens_send_submitted", {
                token_symbol: "USDC",
                amount_bucket: "1-10",
            });
            expect(mockTrack).toHaveBeenCalledWith("tokens_send_submitted", {
                token_symbol: "USDC",
                amount_bucket: "1-10",
                flow_id: flow.flowId,
            });
        });

        it("allows undefined properties", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            flow.track("tokens_send_biometric_requested");
            expect(mockTrack).toHaveBeenCalledWith(
                "tokens_send_biometric_requested",
                { flow_id: flow.flowId }
            );
        });
    });

    describe("end", () => {
        it("emits {name}_succeeded with computed duration_ms", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            vi.advanceTimersByTime(2500);
            flow.end("succeeded", { token_symbol: "USDC" });
            expect(mockTrack).toHaveBeenCalledWith("tokens_send_succeeded", {
                flow_name: "tokens_send",
                flow_id: flow.flowId,
                duration_ms: 2500,
                token_symbol: "USDC",
            });
            expect(flow.ended).toBe(true);
        });

        it("emits {name}_failed, {name}_abandoned and {name}_cancelled", () => {
            const failed = startFlow("auth_login");
            mockTrack.mockClear();
            failed.end("failed", { error_type: "timeout" });
            expect(mockTrack).toHaveBeenLastCalledWith(
                "auth_login_failed",
                expect.objectContaining({ error_type: "timeout" })
            );

            const abandoned = startFlow("onboarding");
            mockTrack.mockClear();
            abandoned.end("abandoned", { last_step: "slide_2" });
            expect(mockTrack).toHaveBeenLastCalledWith(
                "onboarding_abandoned",
                expect.objectContaining({ last_step: "slide_2" })
            );

            const cancelled = startFlow("tokens_send");
            mockTrack.mockClear();
            cancelled.end("cancelled");
            expect(mockTrack).toHaveBeenLastCalledWith(
                "tokens_send_cancelled",
                expect.objectContaining({ flow_name: "tokens_send" })
            );
        });
    });

    describe("guards", () => {
        it("double-end is idempotent — subsequent end() calls are no-ops", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            flow.end("succeeded");
            flow.end("failed");
            flow.end("cancelled");
            expect(mockTrack).toHaveBeenCalledTimes(1);
            expect(mockTrack).toHaveBeenLastCalledWith(
                "tokens_send_succeeded",
                expect.anything()
            );
        });

        it("track-after-end drops silently — late async callbacks can't leak", () => {
            const flow = startFlow("tokens_send");
            flow.end("succeeded");
            mockTrack.mockClear();
            flow.track("tokens_send_submitted", {
                token_symbol: "USDC",
                amount_bucket: "1-10",
            });
            expect(mockTrack).not.toHaveBeenCalled();
        });
    });
});
