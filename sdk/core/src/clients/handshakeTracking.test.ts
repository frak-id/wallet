import { Deferred } from "@frak-labs/frame-connector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeIframeBoot } from "../utils/iframe/iframeBoot";
import { HANDSHAKE_TIMEOUT_MS, trackHandshake } from "./handshakeTracking";

function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
}

describe("trackHandshake", () => {
    let iframe: HTMLIFrameElement;
    let connected: Deferred<boolean>;
    const track = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        track.mockReset();
        setVisibility("visible");
        iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        connected = new Deferred<boolean>();
    });

    afterEach(() => {
        iframe.remove();
        vi.useRealTimers();
    });

    function start() {
        trackHandshake({
            track,
            isConnected: connected.promise,
            iframe,
            startedAt: Date.now(),
        });
    }

    it("reports a connection once, without a timeout", async () => {
        start();
        connected.resolve(true);
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 1);

        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith("sdk_iframe_connected", {
            handshake_duration_ms: 0,
        });
    });

    it("describes the page and listener when it times out", async () => {
        observeIframeBoot(iframe, "https://wallet.frak.id");
        iframe.dispatchEvent(new Event("load"));
        start();
        setVisibility("hidden");
        setVisibility("visible");
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);

        expect(track).toHaveBeenCalledWith("sdk_iframe_handshake_failed", {
            reason: "timeout",
            visibility_state: "visible",
            was_hidden: true,
            online: navigator.onLine,
            listener_seen: false,
            iframe_load_ms: 0,
        });
    });

    it("reports the listener's boot error when it timed out", async () => {
        observeIframeBoot(iframe, "https://wallet.frak.id");
        start();
        window.dispatchEvent(
            new MessageEvent("message", {
                data: {
                    iframeLifecycle: "boot-error",
                    data: { message: "TypeError: boom" },
                },
                origin: "https://wallet.frak.id",
                source: iframe.contentWindow,
            })
        );
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);

        expect(track).toHaveBeenCalledWith(
            "sdk_iframe_handshake_failed",
            expect.objectContaining({
                reason: "timeout",
                listener_seen: true,
                listener_error: "TypeError: boom",
            })
        );
    });

    it("omits listener fields for an iframe it did not create", async () => {
        start();
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);

        expect(track.mock.calls[0]?.[1]).not.toHaveProperty("listener_seen");
    });

    it("still reports a connection that arrives after the timeout", async () => {
        start();
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS + 5_000);
        connected.resolve(true);
        await vi.advanceTimersByTimeAsync(0);

        expect(track).toHaveBeenLastCalledWith("sdk_iframe_connected", {
            handshake_duration_ms: HANDSHAKE_TIMEOUT_MS + 5_000,
            after_timeout: true,
        });
    });

    it("reports an unknown failure when the connection rejects", async () => {
        start();
        connected.reject(new Error("boom"));
        await vi.advanceTimersByTimeAsync(HANDSHAKE_TIMEOUT_MS);

        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith("sdk_iframe_handshake_failed", {
            reason: "unknown",
        });
    });
});
