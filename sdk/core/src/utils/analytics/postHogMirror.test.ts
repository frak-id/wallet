import type { TrackPayload } from "@openpanel/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPostHogMirror } from "./postHogMirror";

const HOST = "https://ph.frak.id";
const TOKEN = "phc_test_token";

function mirrorOrFail(host: string | undefined, token: string | undefined) {
    const mirror = createPostHogMirror(host, token);
    if (!mirror) throw new Error("mirror should be on");
    return mirror;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
    return JSON.parse(fetchMock.mock.calls[call]?.[1].body);
}

describe("createPostHogMirror", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts one mapped event to the capture endpoint", () => {
        const payload: TrackPayload = {
            name: "share_button_clicked",
            profileId: "profile-1",
            properties: {
                __deviceId: "device-1",
                __timestamp: "2026-11-24T10:00:00.000Z",
                __path: "https://shop.example/p/1",
                __referrer: "https://google.com/",
                placement: "footer",
                wallet: "0x1111111111111111111111111111111111111111",
                referrer_wallet: "0x2222222222222222222222222222222222222222",
                hash: "0x3333333333333333333333333333333333333333333333333333333333333333",
            },
        };

        mirrorOrFail(HOST, TOKEN)(payload);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe(`${HOST}/i/v0/e/`);
        expect(init).toMatchObject({
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
        });
        expect(sentBody(fetchMock)).toEqual({
            api_key: TOKEN,
            event: "share_button_clicked",
            distinct_id: "device-1",
            timestamp: "2026-11-24T10:00:00.000Z",
            properties: {
                __deviceId: "device-1",
                __timestamp: "2026-11-24T10:00:00.000Z",
                __path: "https://shop.example/p/1",
                __referrer: "https://google.com/",
                placement: "footer",
                $process_person_profile: false,
                $current_url: "https://shop.example/p/1",
                $referrer: "https://google.com/",
                $raw_user_agent: navigator.userAgent,
                op_profile_id: "profile-1",
            },
        });
    });

    it("sends no value that identifies a wallet", () => {
        const address = "0x4444444444444444444444444444444444444444";
        const v1Context = "REREREREREREREREREREREREREQ";
        mirrorOrFail(
            HOST,
            TOKEN
        )({
            name: "user_referred_started",
            properties: {
                __deviceId: "device-1",
                referrer: address,
                __path: `https://shop.example/p/1?utm_source=x&fCtx=${v1Context}`,
                iframeReferrer: `https://shop.example/?fctx=${v1Context}`,
                contextUrl: `https://shop.example/#/p?fCtx=${v1Context}`,
                link: `https://wallet.frak.id/history/${address}`,
                wallet_status: "connected",
            },
        });

        const { properties } = sentBody(fetchMock);
        expect(properties).not.toHaveProperty("referrer");
        expect(properties).not.toHaveProperty("contextUrl");
        expect(properties).not.toHaveProperty("link");
        expect(properties.__path).toBe("https://shop.example/p/1?utm_source=x");
        expect(properties.$current_url).toBe(
            "https://shop.example/p/1?utm_source=x"
        );
        expect(properties.iframeReferrer).toBe("https://shop.example/");
        expect(properties.wallet_status).toBe("connected");
    });

    it("sends a screen_view as a $pageview with its url", () => {
        mirrorOrFail(
            HOST,
            TOKEN
        )({
            name: "screen_view",
            properties: {
                __deviceId: "device-1",
                __path: "https://wallet.frak.id/wallet",
            },
        });

        const body = sentBody(fetchMock);
        expect(body.event).toBe("$pageview");
        expect(body.properties.$current_url).toBe(
            "https://wallet.frak.id/wallet"
        );
    });

    it("keeps one random anonymous id per mirror when no device id is set", () => {
        const mirror = mirrorOrFail(HOST, TOKEN);
        mirror({ name: "a", properties: { __deviceId: "" } });
        mirror({ name: "b" });
        const other = mirrorOrFail(HOST, TOKEN);
        other({ name: "c" });

        const [first, second, third] = [0, 1, 2].map(
            (call) => sentBody(fetchMock, call).distinct_id
        );
        expect(first).toMatch(/^[0-9a-f-]{36}$/);
        expect(second).toBe(first);
        expect(third).not.toBe(first);
        expect(sentBody(fetchMock, 1)).not.toHaveProperty("timestamp");
    });

    it.each([
        [undefined, TOKEN],
        [HOST, undefined],
        ["", TOKEN],
        [HOST, ""],
    ])("is off when host=%j and token=%j", (host, token) => {
        expect(createPostHogMirror(host, token)).toBeUndefined();
    });

    it("leaves no unhandled rejection when the request fails", async () => {
        // A plain stub: vi.fn subscribes to returned promises, which would hide the rejection.
        let calls = 0;
        vi.stubGlobal("fetch", () => {
            calls++;
            return Promise.reject(new TypeError("Failed to fetch"));
        });

        mirrorOrFail(HOST, TOKEN)({ name: "any" });

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(calls).toBe(1);
    });

    it("never throws into the caller", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        const mirror = mirrorOrFail(HOST, TOKEN);

        expect(() =>
            mirror({ name: "any", properties: circular })
        ).not.toThrow();
        fetchMock.mockImplementation(() => {
            throw new Error("fetch is gone");
        });
        expect(() => mirror({ name: "any" })).not.toThrow();
    });
});
