import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHostResults } from "./bridge";
import { useHostBridge } from "./useHostBridge";

function Probe({ warm }: { warm: boolean }) {
    useHostBridge({ returnScheme: "frak-acme", sid: "s1", warm });
    return null;
}

/** `ready` is emitted behind two rAFs; this drains both plus the send. */
async function settleFrames() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(64);
    });
}

let assignments: string[] = [];

beforeEach(() => {
    vi.useFakeTimers();
    assignments = [];
    resetHostResults();
    // `location.assign` is non-configurable in jsdom, so it is stubbed wholesale.
    vi.stubGlobal("location", {
        assign: (url: string) => assignments.push(url),
    });
    vi.stubGlobal(
        "requestAnimationFrame",
        (cb: FrameRequestCallback) =>
            setTimeout(() => cb(0), 16) as unknown as number
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) =>
        clearTimeout(handle as unknown as NodeJS.Timeout)
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("useHostBridge ready ping", () => {
    it("pings once a live page has painted", async () => {
        render(<Probe warm={false} />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(1);
    });

    // A warm view is off screen and reports `sharing_page_preloaded`, not a view.
    // Pinging here would drop the host's skeleton over a page nobody can see.
    it("stays silent while the page is warm", async () => {
        render(<Probe warm={true} />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(0);
    });

    // The defect this covers: a pooled view reloaded onto its warm URL mounts warm,
    // and the activation that follows flips `warm` without remounting. Without a
    // ping on that transition the host waits forever on a page that is on screen —
    // observed on an iPad as a grey sheet after share -> install -> share.
    it("pings when a warm page is activated without remounting", async () => {
        const { rerender } = render(<Probe warm={true} />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(0);

        rerender(<Probe warm={false} />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(1);
    });

    // The host pools one view across sessions, so the same document is activated
    // again for the next share; each presentation needs its own ping.
    it("pings again on a second activation of the same document", async () => {
        const { rerender } = render(<Probe warm={false} />);
        await settleFrames();

        rerender(<Probe warm={true} />);
        await settleFrames();

        rerender(<Probe warm={false} />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(2);
    });

    it("sends nothing without a return scheme", async () => {
        function NoScheme() {
            useHostBridge({ sid: "s1", warm: false });
            return null;
        }
        render(<NoScheme />);
        await settleFrames();
        expect(
            assignments.filter((url) => url.includes("action=ready"))
        ).toHaveLength(0);
    });
});
