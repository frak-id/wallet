import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    authAccountQueryKey,
    authSessionsQueryKey,
    invitePreviewQueryKey,
    twoFactorMethodsQueryKey,
} from "./queryKeys";

describe("auth query keys", () => {
    test("builders return the exact tuples the call sites inlined", () => {
        expect(authAccountQueryKey()).toEqual(["auth", "account"]);
        expect(authSessionsQueryKey()).toEqual(["auth", "sessions"]);
        expect(twoFactorMethodsQueryKey()).toEqual(["auth", "2fa", "methods"]);
        expect(invitePreviewQueryKey("tok")).toEqual([
            "auth",
            "invite",
            "preview",
            "tok",
        ]);
    });
});
