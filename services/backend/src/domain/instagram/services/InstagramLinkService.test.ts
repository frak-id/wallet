import { HttpError } from "@backend-utils";
import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstagramLinkSelect } from "../db/schema";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
import type { InstagramPendingLinkRepository } from "../repositories/InstagramPendingLinkRepository";
import { InstagramLinkService } from "./InstagramLinkService";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({ productEvents: { track } }));

const GROUP = "group-1";
const CHECKED_AT = new Date("2026-10-26T10:00:00Z");
const DECLARED_AT = new Date("2026-10-27T10:00:00Z");

const row: InstagramLinkSelect = {
    id: "link-1",
    identityGroupId: GROUP,
    igsid: "17841400000000000",
    username: "frak_fr",
    follows: true,
    checkedAt: CHECKED_AT,
    createdAt: new Date("2026-10-20T10:00:00Z"),
};

function setup() {
    const repository = {
        findByIdentityGroup: vi.fn(),
        certify: vi.fn(),
    };
    const pending = {
        findDeclaration: vi.fn().mockResolvedValue(null),
        declare: vi.fn(
            async (params: { identityGroupId: string; username: string }) => ({
                id: "pending-1",
                ...params,
                declaredAt: DECLARED_AT,
            })
        ),
        undeclare: vi.fn(),
        getOrCreateCode: vi.fn().mockResolvedValue("K7Q2PX"),
    };
    const service = new InstagramLinkService(
        repository as unknown as InstagramLinkRepository,
        pending as unknown as InstagramPendingLinkRepository
    );
    return { repository, pending, service };
}

describe("InstagramLinkService", () => {
    beforeEach(() => {
        vi.useRealTimers();
        track.mockReset();
    });

    it("exposes a link without its igsid", async () => {
        const { repository, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(row);

        const link = await service.find(GROUP);

        expect(link).toEqual({
            username: "frak_fr",
            follows: true,
            checkedAt: CHECKED_AT,
        });
        expect(link).not.toHaveProperty("igsid");
    });

    it("returns null when nothing is linked", async () => {
        const { repository, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(null);

        expect(await service.find(GROUP)).toBeNull();
    });

    it("stamps the follow state with the time of the write", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(CHECKED_AT);
        const { repository, service } = setup();
        repository.certify.mockResolvedValue(row);

        await service.linkWithCode("code-1", {
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows: true,
        });

        expect(repository.certify).toHaveBeenCalledWith(
            {
                identityGroupId: GROUP,
                igsid: row.igsid,
                username: "frak_fr",
                follows: true,
                checkedAt: CHECKED_AT,
            },
            "code-1"
        );
    });

    it("answers 409 when another identity already holds the account", async () => {
        const { repository, service } = setup();
        repository.certify.mockRejectedValue(
            new DrizzleQueryError(
                "insert into instagram_links",
                [],
                Object.assign(new Error("duplicate key"), { code: "23505" })
            )
        );

        const error = await service
            .linkWithCode("code-1", {
                identityGroupId: GROUP,
                igsid: row.igsid,
                username: "frak_fr",
                follows: true,
            })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(HttpError);
        expect(error).toMatchObject({
            status: 409,
            code: "INSTAGRAM_ALREADY_LINKED",
        });
    });

    it("lets any other failure through untranslated", async () => {
        const { repository, service } = setup();
        const failure = new Error("connection lost");
        repository.certify.mockRejectedValue(failure);

        await expect(
            service.linkWithCode("code-1", {
                identityGroupId: GROUP,
                igsid: row.igsid,
                username: "frak_fr",
                follows: false,
            })
        ).rejects.toBe(failure);
    });

    it.each([
        {
            name: "a first link that follows",
            previous: null,
            follows: true,
            events: ["instagram_linked", "instagram_follow_verified"],
        },
        {
            name: "a first link that does not follow",
            previous: null,
            follows: false,
            events: ["instagram_linked"],
        },
        {
            name: "a non-follower who now follows",
            previous: { ...row, follows: false },
            follows: true,
            events: ["instagram_follow_verified"],
        },
        {
            name: "a follower checked again",
            previous: row,
            follows: true,
            events: [],
        },
        {
            name: "an unfollow",
            previous: row,
            follows: false,
            events: [],
        },
    ])("tracks $name", async ({ previous, follows, events }) => {
        const { repository, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(previous);
        repository.certify.mockResolvedValue({ ...row, follows });

        await service.linkWithCode("code-1", {
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows,
        });

        expect(track.mock.calls.map(([name]) => name)).toEqual(events);
        for (const [, groupId] of track.mock.calls) {
            expect(groupId).toBe(GROUP);
        }
    });
});

describe("InstagramLinkService certification and declaration", () => {
    beforeEach(() => track.mockReset());

    it("claims the DM code in the same write as the link", async () => {
        const { repository, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(null);
        repository.certify.mockResolvedValue(row);

        const linked = await service.linkWithCode("code-1", {
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows: true,
        });

        expect(linked).toMatchObject({ username: "frak_fr", follows: true });
        expect(repository.certify).toHaveBeenCalledWith(
            expect.objectContaining({ identityGroupId: GROUP }),
            "code-1"
        );
    });

    it("links nothing and tracks nothing once the code is gone", async () => {
        const { repository, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(null);
        repository.certify.mockResolvedValue(null);

        const linked = await service.linkWithCode("code-1", {
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows: true,
        });

        expect(linked).toBeNull();
        expect(track).not.toHaveBeenCalled();
    });

    it("declares a normalized handle and tracks the first declaration", async () => {
        const { repository, pending, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(null);

        const status = await service.declare(GROUP, "  @Some.One ");

        expect(pending.declare).toHaveBeenCalledWith({
            identityGroupId: GROUP,
            username: "some.one",
        });
        expect(status).toEqual({
            link: null,
            declaration: { username: "some.one", declaredAt: DECLARED_AT },
        });
        expect(track).toHaveBeenCalledWith("instagram_declared", GROUP, {});
    });

    it("does not track a changed handle again", async () => {
        const { repository, pending, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(null);
        pending.findDeclaration.mockResolvedValue({
            username: "old",
        });

        await service.declare(GROUP, "new_handle");

        expect(track).not.toHaveBeenCalled();
    });

    it("answers 400 for something that cannot be a handle", async () => {
        const { pending, service } = setup();

        await expect(
            service.declare(GROUP, "not a handle")
        ).rejects.toMatchObject({
            status: 400,
            code: "INVALID_INSTAGRAM_HANDLE",
        });
        expect(pending.declare).not.toHaveBeenCalled();
    });

    it("answers 409 once the wallet is certified", async () => {
        const { repository, pending, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(row);

        await expect(service.declare(GROUP, "someone")).rejects.toMatchObject({
            status: 409,
            code: "INSTAGRAM_ALREADY_CERTIFIED",
        });
        expect(pending.declare).not.toHaveBeenCalled();
    });

    it("reports a certified link alone, never a leftover declaration", async () => {
        const { repository, pending, service } = setup();
        repository.findByIdentityGroup.mockResolvedValue(row);
        pending.findDeclaration.mockResolvedValue({
            username: "old",
            declaredAt: DECLARED_AT,
        });

        await expect(service.status(GROUP)).resolves.toEqual({
            link: { username: "frak_fr", follows: true, checkedAt: CHECKED_AT },
            declaration: null,
        });
    });

    it("hands out the group's code", async () => {
        const { pending, service } = setup();

        await expect(service.issueCode(GROUP)).resolves.toBe("K7Q2PX");
        expect(pending.getOrCreateCode).toHaveBeenCalledWith(GROUP);
    });
});
