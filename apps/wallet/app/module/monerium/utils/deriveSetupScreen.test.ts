import { describe, expect, test } from "vitest";
import { moneriumStatus } from "@/tests/moneriumFixtures";
import {
    deriveSetupScreen,
    isMoneriumStatusPending,
    type MoneriumStatus,
} from "./deriveSetupScreen";

type ProfileState = NonNullable<MoneriumStatus["profile"]>["state"];

function withProfile(
    state: ProfileState,
    overrides: Partial<MoneriumStatus> = {}
) {
    return moneriumStatus({
        profile: { id: "p", kind: "personal", state },
        ...overrides,
    });
}

const sandbox = { environment: "sandbox" } as const;

describe("deriveSetupScreen", () => {
    test.each([
        ["no status yet", undefined, "loading"],
        [
            "never connected",
            moneriumStatus({ connection: "none", profile: null }),
            "info",
        ],
        [
            "expired session",
            moneriumStatus({ connection: "reauth_required" }),
            "reconnect",
        ],
        [
            "connected without profile",
            moneriumStatus({ profile: null }),
            "onboarding",
        ],
        ["created", withProfile("created"), "onboarding"],
        ["incomplete", withProfile("incomplete"), "onboarding"],
        ["pending", withProfile("pending"), "verification"],
        ["review", withProfile("review"), "verification"],
        ["rejected", withProfile("rejected"), "blocked"],
        ["closed", withProfile("closed"), "blocked"],
        ["approved, link none", moneriumStatus({ walletLink: "none" }), "link"],
        [
            "approved, link pending",
            moneriumStatus({ walletLink: "pending" }),
            "linking",
        ],
    ] as const)("%s -> %s", (_, input, expected) => {
        expect(deriveSetupScreen(input, false)).toBe(expected);
    });

    test.each([
        ["created", "link"],
        ["incomplete", "link"],
        ["pending", "link"],
        ["review", "link"],
        ["rejected", "blocked"],
        ["closed", "blocked"],
    ] as const)(
        "sandbox lets a %s profile through -> %s",
        (state, expected) => {
            expect(
                deriveSetupScreen(
                    withProfile(state, { ...sandbox, walletLink: "none" }),
                    false
                )
            ).toBe(expected);
        }
    );

    test("sandbox without any profile still onboards", () => {
        expect(
            deriveSetupScreen(
                moneriumStatus({ ...sandbox, profile: null }),
                false
            )
        ).toBe("onboarding");
    });

    test("linked shows the success once, then the transfer", () => {
        expect(deriveSetupScreen(moneriumStatus(), false)).toBe("success");
        expect(deriveSetupScreen(moneriumStatus(), true)).toBe("transfer");
    });

    test("a reauth with a rejected cached profile still reconnects first", () => {
        expect(
            deriveSetupScreen(
                moneriumStatus({
                    connection: "reauth_required",
                    profile: { id: "p", kind: "personal", state: "rejected" },
                }),
                true
            )
        ).toBe("reconnect");
    });
});

describe("isMoneriumStatusPending", () => {
    test.each([
        ["created", withProfile("created"), true],
        [
            "connected without a profile yet",
            moneriumStatus({ profile: null }),
            true,
        ],
        ["review", withProfile("review"), true],
        [
            "approved + link pending",
            moneriumStatus({ walletLink: "pending" }),
            true,
        ],
        ["approved + linked", moneriumStatus(), false],
        ["rejected", withProfile("rejected"), false],
        [
            "reauth with pending profile",
            moneriumStatus({
                connection: "reauth_required",
                profile: { id: "p", kind: "personal", state: "pending" },
            }),
            false,
        ],
        ["undefined", undefined, false],
        ["sandbox pending + linked", withProfile("pending", sandbox), false],
        [
            "sandbox pending + link pending",
            withProfile("pending", { ...sandbox, walletLink: "pending" }),
            true,
        ],
    ] as const)("%s", (_, input, expected) => {
        expect(isMoneriumStatusPending(input)).toBe(expected);
    });
});
