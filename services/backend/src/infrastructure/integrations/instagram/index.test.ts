import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramGraphClient } from "./index";

vi.mock("@backend-infrastructure/external/logger", () => ({
    log: { warn: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn();
const client = new InstagramGraphClient("https://graph.test");

function answer(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status })
    );
}

describe("InstagramGraphClient.lookupProfile", () => {
    afterEach(() => {
        fetchMock.mockReset();
        vi.unstubAllGlobals();
    });

    it("reads the username and follow, sending the token in a header only", async () => {
        vi.stubGlobal("fetch", fetchMock);
        answer(200, {
            username: "player",
            is_user_follow_business: true,
            id: "igsid",
        });

        await expect(client.lookupProfile("igsid", "secret")).resolves.toEqual({
            kind: "found",
            username: "player",
            follows: true,
        });
        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe(
            "https://graph.test/v26.0/igsid?fields=username,is_user_follow_business"
        );
        expect(String(url)).not.toContain("secret");
        expect(init.headers).toEqual({ Authorization: "Bearer secret" });
    });

    it.each([
        ["an expired token", 400, { error: { code: 190 } }],
        ["a permission error", 403, { error: { code: 200 } }],
        ["throttling", 429, { error: { code: 4 } }],
        ["an outage", 503, {}],
        ["an error without a code", 400, {}],
    ])("is unavailable on %s", async (_name, status, body) => {
        vi.stubGlobal("fetch", fetchMock);
        answer(status, body);

        await expect(client.lookupProfile("igsid", "t")).resolves.toEqual({
            kind: "unavailable",
        });
    });

    it("is unavailable when Meta cannot be reached", async () => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

        await expect(client.lookupProfile("igsid", "t")).resolves.toEqual({
            kind: "unavailable",
        });
    });

    it("reports a profile Meta refuses for this user as gone", async () => {
        vi.stubGlobal("fetch", fetchMock);
        answer(400, {
            error: { code: 100, message: "Unsupported get request" },
        });

        await expect(client.lookupProfile("igsid", "t")).resolves.toEqual({
            kind: "gone",
            code: 100,
        });
    });
});

describe("InstagramGraphClient.refreshToken", () => {
    afterEach(() => {
        fetchMock.mockReset();
        vi.unstubAllGlobals();
    });

    it("returns the new token and its lifetime", async () => {
        vi.stubGlobal("fetch", fetchMock);
        answer(200, { access_token: "renewed", expires_in: 5_184_000 });

        await expect(client.refreshToken("old")).resolves.toEqual({
            token: "renewed",
            expiresInSeconds: 5_184_000,
        });
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "grant_type=ig_refresh_token"
        );
    });

    it("returns null when Meta refuses", async () => {
        vi.stubGlobal("fetch", fetchMock);
        answer(400, { error: { code: 190 } });

        await expect(client.refreshToken("old")).resolves.toBeNull();
    });
});
