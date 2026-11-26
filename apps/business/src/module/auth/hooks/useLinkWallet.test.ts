import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { AuthError } from "@/module/auth/utils/authError";
import { linkWalletErrorMessage } from "./useLinkWallet";

const t = ((key: string) => key) as unknown as TFunction;

describe("linkWalletErrorMessage", () => {
    it("returns null without an error", () => {
        expect(linkWalletErrorMessage(null, t)).toBeNull();
    });

    it("maps the known link-wallet codes", () => {
        expect(
            linkWalletErrorMessage(new AuthError("raw", "WALLET_TAKEN"), t)
        ).toBe("errors.linkWallet.walletTaken");
        expect(
            linkWalletErrorMessage(new AuthError("raw", "STEP_UP_REQUIRED"), t)
        ).toBe("errors.linkWallet.stepUpRequired");
    });

    it("never shows the raw backend message for an unknown code", () => {
        expect(
            linkWalletErrorMessage(new AuthError("Invalid proof", "BAD"), t)
        ).toBe("errors.linkWallet.generic");
        expect(linkWalletErrorMessage(new Error("boom"), t)).toBe(
            "errors.linkWallet.generic"
        );
    });
});
