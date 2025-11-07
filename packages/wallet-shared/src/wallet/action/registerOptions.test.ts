import { WebAuthN } from "@frak-labs/app-essentials";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { getRegisterOptions } from "./registerOptions";

describe("getRegisterOptions", () => {
    test("should return registration options with correct structure", () => {
        const date = new Date();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString();
        const expectedUsername = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

        const result = getRegisterOptions();

        expect(result).toEqual({
            rp: {
                id: WebAuthN.rpId,
                name: WebAuthN.rpName,
            },
            user: {
                name: expectedUsername,
                displayName: expectedUsername,
            },
            timeout: 180_000,
            attestation: "direct",
            authenticatorSelection: {
                residentKey: "required",
                userVerification: "required",
            },
        });
    });

    test("should generate username with current date", () => {
        const date = new Date();
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear().toString();
        const expectedUsername = `${WebAuthN.defaultUsername}-${day}-${month}-${year}`;

        const result = getRegisterOptions();

        expect(result.user.name).toBe(expectedUsername);
        expect(result.user.displayName).toBe(expectedUsername);
    });

    test("should set timeout to 3 minutes", () => {
        const result = getRegisterOptions();

        expect(result.timeout).toBe(180_000);
    });

    test("should require resident key and user verification", () => {
        const result = getRegisterOptions();

        expect(result.authenticatorSelection.residentKey).toBe("required");
        expect(result.authenticatorSelection.userVerification).toBe("required");
    });
});
