import {
    buildRedeemOrderMessage,
    MONERIUM_DEFAULT_MEMO,
} from "@frak-labs/app-essentials/monerium";
import { describe, expect, it } from "vitest";
import type { MoneriumPlaceOrderBody } from "../schemas";
import { validateRedeemOrder } from "./orderValidation";

const NOW = new Date("2026-10-15T12:00:30Z");
const IBAN = "DE89370400440532013000";
const SIGNATURE = "0xabcdef" as const;

function bodyWith(
    overrides: Partial<MoneriumPlaceOrderBody> & {
        messageAt?: Date;
        messageAmount?: string;
        messageIban?: string;
    } = {}
): MoneriumPlaceOrderBody {
    const {
        messageAt = new Date("2026-10-15T12:02:00Z"),
        messageAmount,
        messageIban,
        ...rest
    } = overrides;
    const amount = rest.amount ?? "12.5";
    return {
        orderId: "3f0b6f7c-8c6c-4f7a-9d0f-2f4f0f9d2a11",
        amount,
        iban: IBAN,
        counterpart: { own: true },
        message: buildRedeemOrderMessage({
            amount: messageAmount ?? amount,
            iban: messageIban ?? IBAN,
            at: messageAt,
        }),
        signature: SIGNATURE,
        ...rest,
    };
}

const thirdParty = {
    own: false,
    firstName: "Satoshi",
    lastName: "Nakamoto",
    country: "FR",
} as const;

describe("validateRedeemOrder", () => {
    it("accepts an own payout and defaults the memo", () => {
        const result = validateRedeemOrder(bodyWith(), NOW, "personal");
        expect(result).toMatchObject({
            amount: "12.5",
            iban: IBAN,
            memo: MONERIUM_DEFAULT_MEMO,
            own: true,
            details: { own: true },
        });
    });

    it("normalizes a keypad amount and a spaced lowercase IBAN", () => {
        const result = validateRedeemOrder(
            bodyWith({
                amount: "12,5",
                iban: "de89 3704 0044 0532 0130 00",
                messageAmount: "12.5",
            }),
            NOW,
            "personal"
        );
        expect(result.amount).toBe("12.5");
        expect(result.iban).toBe(IBAN);
    });

    it("trims and uppercases third-party details", () => {
        const result = validateRedeemOrder(
            bodyWith({
                counterpart: {
                    ...thirdParty,
                    firstName: " Satoshi ",
                    country: "fr",
                },
                memo: "  Rent for October ",
            }),
            NOW,
            "personal"
        );
        expect(result.details).toEqual({
            firstName: "Satoshi",
            lastName: "Nakamoto",
            country: "FR",
        });
        expect(result.memo).toBe("Rent for October");
    });

    it("rejects an invalid amount", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ amount: "0", messageAmount: "1" }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({
                status: 422,
                code: "MONERIUM_INVALID_AMOUNT",
            })
        );
    });

    it("rejects a bad IBAN checksum", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ iban: "DE89370400440532013001" }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_INVALID_IBAN" })
        );
    });

    it("rejects an invalid third-party counterpart", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ counterpart: { ...thirdParty, country: "FRA" } }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_INVALID_COUNTERPART" })
        );
    });

    it("rejects an invalid memo", () => {
        expect(() =>
            validateRedeemOrder(bodyWith({ memo: "abcd" }), NOW, "personal")
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_INVALID_MEMO" })
        );
    });

    it("treats a blank memo as absent", () => {
        expect(
            validateRedeemOrder(bodyWith({ memo: "   " }), NOW, "personal").memo
        ).toBe(MONERIUM_DEFAULT_MEMO);
    });

    it("rejects a message whose amount differs from the body", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ messageAmount: "99" }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_INVALID_MESSAGE" })
        );
    });

    it("rejects a message whose IBAN differs from the body", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ messageIban: "FR7630006000011234567890189" }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_INVALID_MESSAGE" })
        );
    });

    it("rejects a message older than 5 minutes", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ messageAt: new Date("2026-10-15T11:54:00Z") }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_MESSAGE_EXPIRED" })
        );
    });

    it("rejects a message more than 10 minutes in the future", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ messageAt: new Date("2026-10-15T12:12:00Z") }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_MESSAGE_EXPIRED" })
        );
    });

    it("caps third-party payouts", () => {
        expect(() =>
            validateRedeemOrder(
                bodyWith({ amount: "15000", counterpart: thirdParty }),
                NOW,
                "personal"
            )
        ).toThrowError(
            expect.objectContaining({ code: "MONERIUM_AMOUNT_LIMIT" })
        );
    });

    it("exempts corporate profiles from the cap", () => {
        const body = bodyWith({ amount: "20000", counterpart: thirdParty });
        expect(() => validateRedeemOrder(body, NOW, "corporate")).not.toThrow();
    });

    it("exempts own payouts from the cap", () => {
        expect(() =>
            validateRedeemOrder(bodyWith({ amount: "50000" }), NOW, "personal")
        ).not.toThrow();
    });
});
