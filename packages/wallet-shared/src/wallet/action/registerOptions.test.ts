import { WebAuthN } from "@frak-labs/app-essentials";
import { afterAll, beforeAll, vi } from "vitest";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { getRegisterOptions } from "./registerOptions";

describe("getRegisterOptions", () => {
    beforeAll(() => {
        vi.useFakeTimers();
        // Local-time construction: the username is built from local getters.
        vi.setSystemTime(new Date(2026, 2, 7, 12, 0, 0));
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    test("should return registration options with a date-stamped username", () => {
        expect(getRegisterOptions()).toEqual({
            rp: {
                id: WebAuthN.rpId,
                name: WebAuthN.rpName,
            },
            user: {
                name: `${WebAuthN.defaultUsername}-07-03-2026`,
                displayName: `${WebAuthN.defaultUsername}-07-03-2026`,
            },
            timeout: 180_000,
            attestation: "direct",
            authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "required",
                requireResidentKey: false,
            },
        });
    });
});
