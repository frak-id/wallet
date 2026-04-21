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
        it("emits flow_started with a fresh flow_id on creation", () => {
            const flow = startFlow("tokens_send");
            expect(flow.flowId).toMatch(/.+/);
            expect(flow.flowName).toBe("tokens_send");
            expect(flow.ended).toBe(false);
            expect(mockTrack).toHaveBeenCalledWith("flow_started", {
                flow_name: "tokens_send",
                flow_id: flow.flowId,
            });
        });

        it("generates unique flow_ids per instance", () => {
            const a = startFlow("tokens_send");
            const b = startFlow("tokens_send");
            expect(a.flowId).not.toBe(b.flowId);
        });
    });

    describe("track", () => {
        it("injects flow_id into scoped track calls", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            flow.track("login_failed", {
                reason: "cancelled",
            });
            expect(mockTrack).toHaveBeenCalledWith("login_failed", {
                reason: "cancelled",
                flow_id: flow.flowId,
            });
        });

        it("allows undefined properties", () => {
            const flow = startFlow("onboarding");
            mockTrack.mockClear();
            flow.track("user_logged_in");
            expect(mockTrack).toHaveBeenCalledWith("user_logged_in", {
                flow_id: flow.flowId,
            });
        });
    });

    describe("end", () => {
        it("emits flow_succeeded with computed duration_ms", () => {
            const flow = startFlow("tokens_send");
            mockTrack.mockClear();
            vi.advanceTimersByTime(2500);
            flow.end("succeeded");
            expect(mockTrack).toHaveBeenCalledWith("flow_succeeded", {
                flow_name: "tokens_send",
                flow_id: flow.flowId,
                duration_ms: 2500,
            });
            expect(flow.ended).toBe(true);
        });

        it("emits flow_failed, flow_abandoned and flow_cancelled", () => {
            const failed = startFlow("a");
            mockTrack.mockClear();
            failed.end("failed", { error_type: "timeout" });
            expect(mockTrack).toHaveBeenLastCalledWith(
                "flow_failed",
                expect.objectContaining({ error_type: "timeout" })
            );

            const abandoned = startFlow("b");
            mockTrack.mockClear();
            abandoned.end("abandoned", { last_step: "slide_2" });
            expect(mockTrack).toHaveBeenLastCalledWith(
                "flow_abandoned",
                expect.objectContaining({ last_step: "slide_2" })
            );

            const cancelled = startFlow("c");
            mockTrack.mockClear();
            cancelled.end("cancelled");
            expect(mockTrack).toHaveBeenLastCalledWith(
                "flow_cancelled",
                expect.objectContaining({ flow_name: "c" })
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
                "flow_succeeded",
                expect.anything()
            );
        });

        it("track-after-end drops silently — late async callbacks can't leak", () => {
            const flow = startFlow("tokens_send");
            flow.end("succeeded");
            mockTrack.mockClear();
            flow.track("login_failed", { reason: "cancelled" });
            expect(mockTrack).not.toHaveBeenCalled();
        });
    });
});
