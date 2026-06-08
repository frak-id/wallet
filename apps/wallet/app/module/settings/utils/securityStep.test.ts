import { describe, expect, test } from "vitest";
import { resolveSecurityStep } from "./securityStep";

describe("resolveSecurityStep", () => {
    test("asks to add an email first (0%)", () => {
        expect(
            resolveSecurityStep({
                hasEmail: false,
                isEmailVerified: false,
                hasRecovery: false,
                recoveryExpiringSoon: false,
            })
        ).toEqual({
            key: "addEmail",
            percent: 0,
            to: "/profile/add-email",
            secured: false,
        });
    });

    test("asks to verify the email once added (25%)", () => {
        expect(
            resolveSecurityStep({
                hasEmail: true,
                isEmailVerified: false,
                hasRecovery: false,
                recoveryExpiringSoon: false,
            })
        ).toEqual({
            key: "verifyEmail",
            percent: 25,
            to: "/profile/verify-email",
            secured: false,
        });
    });

    test("asks to set up recovery once the email is verified (75%)", () => {
        expect(
            resolveSecurityStep({
                hasEmail: true,
                isEmailVerified: true,
                hasRecovery: false,
                recoveryExpiringSoon: false,
            })
        ).toEqual({
            key: "setupRecovery",
            percent: 75,
            to: "/profile/recovery",
            secured: false,
        });
    });

    test("asks to update recovery when it expires soon (75%)", () => {
        expect(
            resolveSecurityStep({
                hasEmail: true,
                isEmailVerified: true,
                hasRecovery: true,
                recoveryExpiringSoon: true,
            })
        ).toEqual({
            key: "updateRecovery",
            percent: 75,
            to: "/profile/recovery",
            secured: false,
        });
    });

    test("reports a fully secured wallet (100%)", () => {
        expect(
            resolveSecurityStep({
                hasEmail: true,
                isEmailVerified: true,
                hasRecovery: true,
                recoveryExpiringSoon: false,
            })
        ).toEqual({
            key: "secured",
            percent: 100,
            to: "/profile/recovery",
            secured: true,
        });
    });
});
