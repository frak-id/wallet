import { HttpError } from "@backend-utils";
import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstagramLinkSelect } from "../db/schema";
import type { InstagramLinkRepository } from "../repositories/InstagramLinkRepository";
import { InstagramLinkService } from "./InstagramLinkService";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({ productEvents: { track } }));

const GROUP = "group-1";
const CHECKED_AT = new Date("2026-10-26T10:00:00Z");

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
        upsert: vi.fn(),
        deleteByIdentityGroup: vi.fn(),
    };
    const service = new InstagramLinkService(
        repository as unknown as InstagramLinkRepository
    );
    return { repository, service };
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
        repository.upsert.mockResolvedValue(row);

        await service.link({
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows: true,
        });

        expect(repository.upsert).toHaveBeenCalledWith({
            identityGroupId: GROUP,
            igsid: row.igsid,
            username: "frak_fr",
            follows: true,
            checkedAt: CHECKED_AT,
        });
    });

    it("answers 409 when another identity already holds the account", async () => {
        const { repository, service } = setup();
        repository.upsert.mockRejectedValue(
            new DrizzleQueryError(
                "insert into instagram_links",
                [],
                Object.assign(new Error("duplicate key"), { code: "23505" })
            )
        );

        const error = await service
            .link({
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
        repository.upsert.mockRejectedValue(failure);

        await expect(
            service.link({
                identityGroupId: GROUP,
                igsid: row.igsid,
                username: "frak_fr",
                follows: false,
            })
        ).rejects.toBe(failure);
    });

    it("deletes the link on unlink", async () => {
        const { repository, service } = setup();

        await service.unlink(GROUP);

        expect(repository.deleteByIdentityGroup).toHaveBeenCalledWith(GROUP);
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
        repository.upsert.mockResolvedValue({ ...row, follows });

        await service.link({
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
