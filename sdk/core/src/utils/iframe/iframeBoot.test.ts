import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    getIframeBootObservation,
    observeIframeBoot,
    stopIframeBootObservation,
} from "./iframeBoot";

const walletUrl = "https://wallet.frak.id";

function postFromListener(
    iframe: HTMLIFrameElement,
    data: unknown,
    origin = walletUrl
) {
    window.dispatchEvent(
        new MessageEvent("message", {
            data,
            origin,
            source: iframe.contentWindow,
        })
    );
}

describe("observeIframeBoot", () => {
    let iframe: HTMLIFrameElement;

    beforeEach(() => {
        iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        observeIframeBoot(iframe, walletUrl);
    });

    afterEach(() => {
        iframe.remove();
    });

    it("starts with the listener unseen", () => {
        expect(getIframeBootObservation(iframe)).toMatchObject({
            listenerSeen: false,
        });
    });

    it("marks the listener seen on its boot-time connected", () => {
        postFromListener(iframe, { iframeLifecycle: "connected" });

        expect(getIframeBootObservation(iframe)?.listenerSeen).toBe(true);
    });

    it("ignores messages from another origin or window", () => {
        postFromListener(
            iframe,
            { iframeLifecycle: "connected" },
            "https://evil.example"
        );
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { iframeLifecycle: "connected" },
                origin: walletUrl,
                source: window,
            })
        );

        expect(getIframeBootObservation(iframe)?.listenerSeen).toBe(false);
    });

    it("keeps a truncated boot error", () => {
        postFromListener(iframe, {
            iframeLifecycle: "boot-error",
            data: { message: "x".repeat(500) },
        });

        const observation = getIframeBootObservation(iframe);
        expect(observation?.listenerSeen).toBe(true);
        expect(observation?.bootError).toHaveLength(200);
    });

    it("tolerates malformed payloads", () => {
        postFromListener(iframe, "not an object");
        postFromListener(iframe, { iframeLifecycle: "boot-error", data: 42 });

        const observation = getIframeBootObservation(iframe);
        expect(observation?.listenerSeen).toBe(true);
        expect(observation?.bootError).toBeUndefined();
    });

    it("stops watching once stopped", () => {
        stopIframeBootObservation(iframe);
        postFromListener(iframe, { iframeLifecycle: "connected" });

        expect(getIframeBootObservation(iframe)?.listenerSeen).toBe(false);
    });

    it("records the load time", () => {
        iframe.dispatchEvent(new Event("load"));

        expect(getIframeBootObservation(iframe)?.loadedAt).toBeTypeOf("number");
    });
});
