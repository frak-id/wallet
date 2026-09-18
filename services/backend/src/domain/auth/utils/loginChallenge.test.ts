import {
    buildCurrentLoginChallenge,
    buildCurrentLoginChallengeHex,
    buildMergeConsentChallenge,
} from "@frak-labs/app-essentials";
import { type Hex, stringToHex } from "viem";
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

// The shared backend mock predates `businessMetrics.loginChallenge`, so this
// file declares the slice of `@backend-infrastructure` the gate actually uses.
const infrastructureMocks = vi.hoisted(() => ({
    businessMetrics: { loginChallenge: vi.fn() },
    log: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

vi.mock("@backend-infrastructure", () => infrastructureMocks);

import { checkLoginChallenge, isFreshLoginChallenge } from "./loginChallenge";

const NOW = new Date("2026-05-20T14:37:12.345Z");
const HOUR = 60 * 60 * 1000;

const LEGACY_CHALLENGE =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const STRICT_FLAG = "WALLET_REQUIRE_FRESH_LOGIN_CHALLENGE";
const originalStrictFlag = process.env[STRICT_FLAG];

function atOffset(hours: number): Date {
    return new Date(NOW.getTime() + hours * HOUR);
}

function requireFreshChallenge() {
    process.env[STRICT_FLAG] = "true";
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    delete process.env[STRICT_FLAG];
    infrastructureMocks.businessMetrics.loginChallenge.mockClear();
    infrastructureMocks.log.warn.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    delete process.env[STRICT_FLAG];
});

afterAll(() => {
    if (originalStrictFlag !== undefined) {
        process.env[STRICT_FLAG] = originalStrictFlag;
    }
});

describe("isFreshLoginChallenge - /login (hex)", () => {
    const check = (challenge: Hex) =>
        isFreshLoginChallenge({ challenge, route: "login" });

    it("reports a stale challenge distinctly from a bad signature", () => {
        const result = checkLoginChallenge({
            challenge: buildCurrentLoginChallengeHex(atOffset(-3)),
            route: "login",
        });
        expect(result).toEqual({
            accepted: false,
            reason: "Stale challenge",
        });
    });

    it("does not leak the freshness verdict for a legacy challenge", () => {
        requireFreshChallenge();
        expect(
            checkLoginChallenge({
                challenge: LEGACY_CHALLENGE,
                route: "login",
            })
        ).toEqual({ accepted: false, reason: "Invalid signature" });
    });

    it("accepts the current hour slot", () => {
        expect(check(buildCurrentLoginChallengeHex(NOW))).toBe(true);
    });

    it("accepts the previous hour slot", () => {
        expect(check(buildCurrentLoginChallengeHex(atOffset(-1)))).toBe(true);
    });

    it("accepts the next hour slot, absorbing client clock skew", () => {
        expect(check(buildCurrentLoginChallengeHex(atOffset(1)))).toBe(true);
    });

    it("rejects a challenge three hours old", () => {
        expect(check(buildCurrentLoginChallengeHex(atOffset(-3)))).toBe(false);
    });

    it("rejects a challenge three hours ahead", () => {
        expect(check(buildCurrentLoginChallengeHex(atOffset(3)))).toBe(false);
    });

    it("accepts mixed-case hex of the current slot", () => {
        const hex = buildCurrentLoginChallengeHex(NOW);
        expect(check(hex.toUpperCase() as Hex)).toBe(true);
    });

    it("counts a fresh challenge as fresh", () => {
        check(buildCurrentLoginChallengeHex(NOW));
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).toHaveBeenCalledWith("login", "fresh");
    });

    it("counts and logs a stale challenge", () => {
        check(buildCurrentLoginChallengeHex(atOffset(-3)));
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).toHaveBeenCalledWith("login", "stale");
        expect(infrastructureMocks.log.warn).toHaveBeenCalled();
    });

    it("accepts a legacy challenge by default", () => {
        expect(check(LEGACY_CHALLENGE)).toBe(true);
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).toHaveBeenCalledWith("login", "legacy");
    });

    it("rejects a legacy challenge once the strict flag is set", () => {
        requireFreshChallenge();
        expect(check(LEGACY_CHALLENGE)).toBe(false);
    });

    it("still accepts a fresh challenge under the strict flag", () => {
        requireFreshChallenge();
        expect(check(buildCurrentLoginChallengeHex(NOW))).toBe(true);
    });

    it("rejects a stale challenge whatever the strict flag", () => {
        requireFreshChallenge();
        expect(check(buildCurrentLoginChallengeHex(atOffset(-3)))).toBe(false);
    });
});

describe("isFreshLoginChallenge - /ecdsaLogin (raw string)", () => {
    const check = (challenge: string) =>
        isFreshLoginChallenge({ challenge, route: "ecdsaLogin" });

    it("accepts the current hour slot", () => {
        expect(check(buildCurrentLoginChallenge(NOW))).toBe(true);
    });

    it("accepts the previous hour slot", () => {
        expect(check(buildCurrentLoginChallenge(atOffset(-1)))).toBe(true);
    });

    it("accepts the next hour slot", () => {
        expect(check(buildCurrentLoginChallenge(atOffset(1)))).toBe(true);
    });

    it("rejects a challenge three hours old", () => {
        expect(check(buildCurrentLoginChallenge(atOffset(-3)))).toBe(false);
    });

    it("accepts a legacy challenge by default", () => {
        expect(check(LEGACY_CHALLENGE)).toBe(true);
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).toHaveBeenCalledWith("ecdsaLogin", "legacy");
    });

    it("rejects a legacy challenge once the strict flag is set", () => {
        requireFreshChallenge();
        expect(check(LEGACY_CHALLENGE)).toBe(false);
    });

    it("does not accept the hex form on the raw-string route", () => {
        requireFreshChallenge();
        expect(check(buildCurrentLoginChallengeHex(NOW))).toBe(false);
    });
});

describe("isFreshLoginChallenge - domain separation", () => {
    const consentChallenge = buildMergeConsentChallenge({
        winner: "0x1234567890AbcdEF1234567890aBcdef12345678",
        loserAuthenticatorId: "credential-id",
        hourSlot: "2026-05-20T14",
    });

    it("never counts a merge-consent challenge as a fresh login", () => {
        isFreshLoginChallenge({
            challenge: consentChallenge,
            route: "ecdsaLogin",
        });
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).not.toHaveBeenCalledWith("ecdsaLogin", "fresh");
    });

    it("counts a merge-consent challenge as legacy while the flag is off", () => {
        expect(
            isFreshLoginChallenge({
                challenge: stringToHex(consentChallenge),
                route: "login",
            })
        ).toBe(true);
        expect(
            infrastructureMocks.businessMetrics.loginChallenge
        ).toHaveBeenCalledWith("login", "legacy");
    });

    it("rejects a merge-consent challenge at login under the strict flag", () => {
        requireFreshChallenge();
        expect(
            isFreshLoginChallenge({
                challenge: consentChallenge,
                route: "ecdsaLogin",
            })
        ).toBe(false);
        expect(
            isFreshLoginChallenge({
                challenge: stringToHex(consentChallenge),
                route: "login",
            })
        ).toBe(false);
    });
});
