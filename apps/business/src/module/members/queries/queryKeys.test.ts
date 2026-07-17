import type { GetMembersParam } from "@/module/members/api/getMerchantMembers";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    audienceCountQueryKey,
    membersPageQueryKey,
    pushHistoryQueryKey,
} from "./queryKeys";

describe("members query keys", () => {
    test("builders return the exact tuples the call sites inlined", () => {
        const scoped = {
            filter: { merchantIds: ["m1"] },
        } as unknown as GetMembersParam;
        expect(membersPageQueryKey("m1", scoped, false)).toEqual([
            "members",
            "page",
            "m1",
            scoped,
            "live",
        ]);
        expect(pushHistoryQueryKey("m1")).toEqual(["push", "history", "m1"]);
        expect(audienceCountQueryKey({ merchantIds: ["m1"] }, true)).toEqual([
            "create-push",
            "audience-count",
            { merchantIds: ["m1"] },
            true,
        ]);
    });
});
