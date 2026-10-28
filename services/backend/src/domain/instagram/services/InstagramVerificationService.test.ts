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
const CODE = { id: "code-1", identityGroupId: GROUP, code: "K7Q2PX" };

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
        refreshProfile: vi.fn().mockResolvedValue(null),
    };
    const codes = {
        findByCodes: vi.fn().mockResolvedValue([]),
        deleteById: vi.fn(),
    };
    const linkService = {
        link: vi.fn().mockResolvedValue({}),
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
        codes as never,
        linkService as never,
        tokens,
        graph
    );
    return { links, codes, linkService, tokens, graph, service };
}

describe("InstagramVerificationService.handleMessage", () => {
    beforeEach(() => vi.useRealTimers());

    it("ignores a DM with no known code, without asking Meta", async () => {
        const { codes, graph, linkService, service } = setup();

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "Coucou, super jeu",
        });

        expect(outcome).toBe("no_code");
        expect(codes.findByCodes).toHaveBeenCalledWith([]);
        expect(graph.lookupProfile).not.toHaveBeenCalled();
        expect(linkService.link).not.toHaveBeenCalled();
    });

    it("links the sender to the code's account with what Meta reports, then burns the code", async () => {
        const { codes, graph, linkService, service } = setup();
        codes.findByCodes.mockResolvedValue([CODE]);

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "voici mon code k7q2px !",
        });

        expect(codes.findByCodes).toHaveBeenCalledWith(["K7Q2PX"]);
        expect(graph.lookupProfile).toHaveBeenCalledWith(IGSID, "token");
        expect(linkService.link).toHaveBeenCalledWith({
            identityGroupId: GROUP,
            igsid: IGSID,
            username: "player",
            follows: true,
        });
        expect(codes.deleteById).toHaveBeenCalledWith("code-1");
        expect(outcome).toBe("linked");
    });

    it("changes nothing when Meta redelivers a handled DM", async () => {
        const { codes, linkService, service } = setup();
        codes.findByCodes
            .mockResolvedValueOnce([CODE])
            .mockResolvedValueOnce([]);
        const message = { igsid: IGSID, text: "K7Q2PX" };

        await service.handleMessage(message);
        const replay = await service.handleMessage(message);

        expect(replay).toBe("no_code");
        expect(linkService.link).toHaveBeenCalledTimes(1);
        expect(codes.deleteById).toHaveBeenCalledTimes(1);
    });

    it("keeps the code when the account already belongs to another wallet", async () => {
        const { codes, linkService, service } = setup();
        codes.findByCodes.mockResolvedValue([CODE]);
        linkService.link.mockRejectedValue(
            HttpError.conflict("INSTAGRAM_ALREADY_LINKED", "taken")
        );

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "K7Q2PX",
        });

        expect(outcome).toBe("already_linked");
        expect(codes.deleteById).not.toHaveBeenCalled();
    });

    it("throws and keeps the code when Meta cannot answer, so the delivery is retried", async () => {
        const { codes, graph, linkService, service } = setup();
        codes.findByCodes.mockResolvedValue([CODE]);
        graph.lookupProfile.mockResolvedValue({ kind: "unavailable" });

        await expect(
            service.handleMessage({ igsid: IGSID, text: "K7Q2PX" })
        ).rejects.toBeInstanceOf(InstagramUnavailableError);
        expect(linkService.link).not.toHaveBeenCalled();
        expect(codes.deleteById).not.toHaveBeenCalled();
    });

    it("keeps the code when the link write fails, so the delivery is retried", async () => {
        const { codes, linkService, service } = setup();
        codes.findByCodes.mockResolvedValue([CODE]);
        const failure = new Error("db down");
        linkService.link.mockRejectedValue(failure);

        await expect(
            service.handleMessage({ igsid: IGSID, text: "K7Q2PX" })
        ).rejects.toBe(failure);
        expect(codes.deleteById).not.toHaveBeenCalled();
    });

    it("links nobody when Meta refuses the sender's profile", async () => {
        const { codes, graph, linkService, service } = setup();
        codes.findByCodes.mockResolvedValue([CODE]);
        graph.lookupProfile.mockResolvedValue({ kind: "gone", code: 100 });

        const outcome = await service.handleMessage({
            igsid: IGSID,
            text: "K7Q2PX",
        });

        expect(outcome).toBe("profile_gone");
        expect(linkService.link).not.toHaveBeenCalled();
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
        expect(links.refreshProfile).toHaveBeenCalledWith("link-1", {
            username: "player",
            follows: true,
            checkedAt: NOW,
        });
        expect(linkService.trackChange).toHaveBeenCalledWith(false, true, link);
        expect(linkService.status).toHaveBeenCalledWith(GROUP);
    });

    it("asks Meta at most every 30 seconds", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroup.mockResolvedValue(
            linkRow({ checkedAt: new Date(NOW.getTime() - 10_000) })
        );

        await service.check(GROUP);

        expect(graph.lookupProfile).not.toHaveBeenCalled();
    });

    it("never calls Meta for a mock link", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroup.mockResolvedValue(
            linkRow({ igsid: "mock_player" })
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

    it("re-reads only real links older than the limit", async () => {
        const { links, graph, service } = setup();
        links.findByIdentityGroups.mockResolvedValue([
            linkRow({ id: "stale", igsid: "stale-igsid" }),
            linkRow({
                id: "fresh",
                igsid: "fresh-igsid",
                checkedAt: new Date(NOW.getTime() - 60_000),
            }),
            linkRow({ id: "mock", igsid: "mock_someone" }),
        ]);

        const count = await service.recheck(["a", "b", "c"], {
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

        expect(links.refreshProfile).toHaveBeenCalledWith("link-1", {
            username: "player",
            follows: false,
            checkedAt: NOW,
        });
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
