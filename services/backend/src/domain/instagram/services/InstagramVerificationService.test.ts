import { HttpError } from "@backend-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstagramLinkSelect } from "../db/schema";
import {
    InstagramUnavailableError,
    InstagramVerificationService,
} from "./InstagramVerificationService";

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    productEvents: { track: vi.fn() },
}));

const GROUP = "group-1";
const IGSID = "17841400000000000";
const NOW = new Date("2026-10-28T10:00:00Z");
const CODE = { identityGroupId: GROUP, code: "K7Q2PX" };

const linkRow = (
    overrides: Partial<InstagramLinkSelect> = {}
): InstagramLinkSelect => ({
    id: "link-1",
    identityGroupId: GROUP,
    igsid: IGSID,
    username: "player",
    follows: false,
    checkedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    createdAt: NOW,
    ...overrides,
});

function setup() {
    const links = {
        findByIdentityGroup: vi.fn().mockResolvedValue(null),
        findByIdentityGroups: vi.fn().mockResolvedValue([]),
        refreshProfile: vi.fn(
            async (link: object, profile: object) =>
                ({ ...link, ...profile }) as unknown
        ),
    };
    const pending = {
        findByCodes: vi.fn().mockResolvedValue([]),
    };
    const linkService = {
        linkWithCode: vi.fn().mockResolvedValue({}),
        status: vi.fn().mockResolvedValue({ link: null, declaration: null }),
        trackChange: vi.fn(),
    };
    const tokens = { current: vi.fn().mockResolvedValue("token") };
    const graph = {
        lookupProfile: vi.fn().mockResolvedValue({
            kind: "found",
            username: "player",
            follows: true,
        }),
    };
    const service = new InstagramVerificationService(
        links as never,
        pending as never,
        linkService as never,
        tokens,
        graph
    );
    return { links, pending, linkService, tokens, graph, service };
}

describe("InstagramVerificationService.handleMessage", () => {
    beforeEach(() => vi.useRealTimers());

    it("ignores a DM with no known code, without asking Meta", async () => {
        const { pending, graph, linkService, service } = setup();

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "Coucou, super jeu",
        });

        expect(outcome).toBe("no_code");
        expect(pending.findByCodes).toHaveBeenCalledWith([]);
        expect(graph.lookupProfile).not.toHaveBeenCalled();
        expect(linkService.linkWithCode).not.toHaveBeenCalled();
    });

    it("links the sender to the code's account with what Meta reports, burning the code", async () => {
        const { pending, graph, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "voici mon code k7q2px !",
        });

        expect(pending.findByCodes).toHaveBeenCalledWith(["K7Q2PX"]);
        expect(graph.lookupProfile).toHaveBeenCalledWith(IGSID, "token");
        expect(linkService.linkWithCode).toHaveBeenCalledWith("K7Q2PX", {
            identityGroupId: GROUP,
            igsid: IGSID,
            username: "player",
            follows: true,
        });
        expect(outcome).toBe("linked");
    });

    it("changes nothing when Meta redelivers a handled DM", async () => {
        const { pending, linkService, service } = setup();
        pending.findByCodes
            .mockResolvedValueOnce([CODE])
            .mockResolvedValueOnce([]);
        const message = { igsid: IGSID, text: "K7Q2PX" };

        await service.handleMessage(message);
        const replay = await service.handleMessage(message);

        expect(replay).toBe("no_code");
        expect(linkService.linkWithCode).toHaveBeenCalledTimes(1);
    });

    it("links nobody when a concurrent delivery or a merge claimed the code first", async () => {
        const { pending, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);
        linkService.linkWithCode.mockResolvedValue(null);

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "K7Q2PX",
        });

        expect(outcome).toBe("no_code");
    });

    it("answers already_linked when the account belongs to another wallet", async () => {
        const { pending, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);
        linkService.linkWithCode.mockRejectedValue(
            HttpError.conflict("INSTAGRAM_ALREADY_LINKED", "taken")
        );

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "K7Q2PX",
        });

        expect(outcome).toBe("already_linked");
    });

    it("throws and keeps the code when Meta cannot answer, so the delivery is retried", async () => {
        const { pending, graph, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);
        graph.lookupProfile.mockResolvedValue({ kind: "unavailable" });

        await expect(
            service.handleMessage({ igsid: IGSID, text: "K7Q2PX" })
        ).rejects.toBeInstanceOf(InstagramUnavailableError);
        expect(linkService.linkWithCode).not.toHaveBeenCalled();
    });

    it("throws when the link write fails, so the delivery is retried", async () => {
        const { pending, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);
        const failure = new Error("db down");
        linkService.linkWithCode.mockRejectedValue(failure);

        await expect(
            service.handleMessage({ igsid: IGSID, text: "K7Q2PX" })
        ).rejects.toBe(failure);
    });

    it("links nobody when Meta refuses the sender's profile", async () => {
        const { pending, graph, linkService, service } = setup();
        pending.findByCodes.mockResolvedValue([CODE]);
        graph.lookupProfile.mockResolvedValue({ kind: "gone", code: 100 });

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "K7Q2PX",
        });

        expect(outcome).toBe("profile_gone");
        expect(linkService.linkWithCode).not.toHaveBeenCalled();
    });
});

describe("InstagramVerificationService.check", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
    });

    it("re-reads a stale link from Meta and stores the answer", async () => {
        const { links, graph, linkService, service } = setup();
        const link = linkRow();
        links.findByIdentityGroup.mockResolvedValue(link);

        await service.check(GROUP);

        expect(graph.lookupProfile).toHaveBeenCalledWith(IGSID, "token");
        expect(links.refreshProfile).toHaveBeenCalledWith(
            expect.objectContaining({ id: "link-1" }),
            {
                username: "player",
                follows: true,
                checkedAt: NOW,
            }
        );
        expect(linkService.trackChange).toHaveBeenCalledWith(false, true, link);
        expect(linkService.status).toHaveBeenCalledWith(GROUP);
    });

    it("tracks nothing for a link replaced by another account meanwhile", async () => {
        const { links, linkService, service } = setup();
        links.findByIdentityGroup.mockResolvedValue(linkRow());
        links.refreshProfile.mockResolvedValue(null);

        await service.check(GROUP);

        expect(linkService.trackChange).not.toHaveBeenCalled();
    });

    it("asks Meta at most every 30 seconds", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroup.mockResolvedValue(
            linkRow({ checkedAt: new Date(NOW.getTime() - 10_000) })
        );

        await service.check(GROUP);

        expect(graph.lookupProfile).not.toHaveBeenCalled();
    });

    it("answers 502 when Meta cannot say, and stores nothing", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroup.mockResolvedValue(linkRow());
        graph.lookupProfile.mockResolvedValue({ kind: "unavailable" });

        await expect(service.check(GROUP)).rejects.toMatchObject({
            status: 502,
            code: "INSTAGRAM_UNAVAILABLE",
        });
        expect(links.refreshProfile).not.toHaveBeenCalled();
    });

    it("only reads the state back when nothing is certified", async () => {
        const { graph, linkService, service } = setup();

        await service.check(GROUP);

        expect(graph.lookupProfile).not.toHaveBeenCalled();
        expect(linkService.status).toHaveBeenCalledWith(GROUP);
    });
});

describe("InstagramVerificationService.recheck", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
    });

    it("re-reads only links older than the limit", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroups.mockResolvedValue([
            linkRow({ id: "stale", igsid: "stale-igsid" }),
            linkRow({
                id: "fresh",
                igsid: "fresh-igsid",
                checkedAt: new Date(NOW.getTime() - 60_000),
            }),
        ]);

        const count = await service.recheck(["a", "b"], {
            maxAgeMs: 5 * 60_000,
        });

        expect(count).toBe(1);
        expect(graph.lookupProfile).toHaveBeenCalledTimes(1);
        expect(graph.lookupProfile).toHaveBeenCalledWith(
            "stale-igsid",
            "token"
        );
    });

    it("counts an account Meta no longer answers for as not following", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroups.mockResolvedValue([
            linkRow({ follows: true }),
        ]);
        graph.lookupProfile.mockResolvedValue({ kind: "gone", code: 100 });

        await service.recheck([GROUP], { maxAgeMs: 0 });

        expect(links.refreshProfile).toHaveBeenCalledWith(
            expect.objectContaining({ id: "link-1" }),
            {
                username: "player",
                follows: false,
                checkedAt: NOW,
            }
        );
    });

    it.each([
        ["Meta does not answer", "token", { kind: "unavailable" }],
        ["no token is configured", null, { kind: "found" }],
    ])(
        "throws when %s, rather than read anyone as not following",
        async (_name, token, lookup) => {
            const { links, tokens, graph, service } = setup();
            links.findByIdentityGroups.mockResolvedValue([linkRow()]);
            tokens.current.mockResolvedValue(token);
            graph.lookupProfile.mockResolvedValue(lookup);

            await expect(
                service.recheck([GROUP], { maxAgeMs: 0 })
            ).rejects.toBeInstanceOf(InstagramUnavailableError);
            expect(links.refreshProfile).not.toHaveBeenCalled();
        }
    );
});
