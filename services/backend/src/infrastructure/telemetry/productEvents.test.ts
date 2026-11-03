import { afterEach, describe, expect, it, vi } from "vitest";

const { create, post } = vi.hoisted(() => {
    const post = vi.fn();
    return { post, create: vi.fn(() => ({ post })) };
});

vi.mock("ky", () => ({ default: { create } }));

vi.mock("@backend-infrastructure/external/logger", () => ({
    log: { warn: vi.fn() },
}));

async function freshProductEvents() {
    vi.resetModules();
    return (await import("./productEvents")).productEvents;
}

describe("productEvents.track", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        create.mockClear();
        post.mockReset();
    });

    it("sends nothing without a write client", async () => {
        vi.stubEnv("OPEN_PANEL_API_URL", "https://op.test/");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_ID", "");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_SECRET", "");
        const productEvents = await freshProductEvents();

        productEvents.track("instagram_follow_verified", "group-1", {});

        expect(create).not.toHaveBeenCalled();
        expect(post).not.toHaveBeenCalled();
    });

    it("posts a track event on the identity group's profile", async () => {
        vi.stubEnv("OPEN_PANEL_API_URL", "https://op.test/");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_ID", "client-id");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_SECRET", "client-secret");
        post.mockResolvedValue({});
        const productEvents = await freshProductEvents();

        productEvents.track("game_joined", "group-1", {
            game_id: "game-1",
            source: "game_code",
            newcomer: true,
        });

        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                prefix: "https://op.test",
                headers: {
                    "openpanel-client-id": "client-id",
                    "openpanel-client-secret": "client-secret",
                },
            })
        );
        expect(post).toHaveBeenCalledWith("track", {
            json: {
                type: "track",
                payload: {
                    name: "game_joined",
                    profileId: "group-1",
                    properties: {
                        game_id: "game-1",
                        source: "game_code",
                        newcomer: true,
                        identity_group_id: "group-1",
                        source_surface: "backend",
                    },
                },
            },
        });
    });

    it("swallows a failed send", async () => {
        vi.stubEnv("OPEN_PANEL_API_URL", "https://op.test/");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_ID", "client-id");
        vi.stubEnv("OPEN_PANEL_TRACK_CLIENT_SECRET", "client-secret");
        post.mockRejectedValue(new Error("down"));
        const productEvents = await freshProductEvents();

        expect(() =>
            productEvents.track("instagram_follow_verified", "group-1", {})
        ).not.toThrow();
    });
});
