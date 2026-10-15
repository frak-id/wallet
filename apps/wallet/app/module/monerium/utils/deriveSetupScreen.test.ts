import { describe, expect, test } from "vitest";
import {
    deriveSetupScreen,
    isMoneriumStatusPending,
    type MoneriumStatus,
} from "./deriveSetupScreen";

function status(overrides: Partial<MoneriumStatus> = {}): MoneriumStatus {
    return {
        connection: "connected",
        profile: { id: "p", kind: "personal", state: "approved" },
        walletLink: "linked",
        silentReconnect: false,
        environment: "sandbox",
        ...overrides,
    };
}

function withProfile(state: NonNullable<MoneriumStatus["profile"]>["state"]) {
    return status({ profile: { id: "p", kind: "personal", state } });
}

describe("deriveSetupScreen", () => {
    test.each([
        ["no status yet", undefined, "loading"],
        [
            "never connected",
            status({ connection: "none", profile: null }),
            "info",
        ],
        [
            "expired session",
            status({ connection: "reauth_required" }),
            "reconnect",
        ],
        ["connected without profile", status({ profile: null }), "onboarding"],
        ["created", withProfile("created"), "onboarding"],
        ["incomplete", withProfile("incomplete"), "onboarding"],
        ["pending", withProfile("pending"), "verification"],
        ["review", withProfile("review"), "verification"],
        ["rejected", withProfile("rejected"), "blocked"],
        ["closed", withProfile("closed"), "blocked"],
        ["approved, link none", status({ walletLink: "none" }), "link"],
        [
            "approved, link pending",
            status({ walletLink: "pending" }),
            "linking",
        ],
    ] as const)("%s -> %s", (_, input, expected) => {
        expect(deriveSetupScreen(input, false)).toBe(expected);
    });

    test("linked shows the success once, then the transfer", () => {
        expect(deriveSetupScreen(status(), false)).toBe("success");
        expect(deriveSetupScreen(status(), true)).toBe("transfer");
    });

    test("a reauth with a rejected cached profile still reconnects first", () => {
        expect(
            deriveSetupScreen(
                status({
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
        ["review", withProfile("review"), true],
        ["approved + link pending", status({ walletLink: "pending" }), true],
        ["approved + linked", status(), false],
        ["rejected", withProfile("rejected"), false],
        [
            "reauth with pending profile",
            status({
                connection: "reauth_required",
                profile: { id: "p", kind: "personal", state: "pending" },
            }),
            false,
        ],
        ["undefined", undefined, false],
    ] as const)("%s", (_, input, expected) => {
        expect(isMoneriumStatusPending(input)).toBe(expected);
    });
});
