import { describe, expect, it } from "vitest";
import {
    buildRedeemOrderMessage,
    formatMessageTimestamp,
    getIbanCountry,
    isMoneriumProfileUsable,
    isValidCounterpartName,
    isValidCountryCode,
    isValidIban,
    isValidMemo,
    normalizeIban,
    normalizeRedeemAmount,
    parseRedeemOrderMessage,
    shortenIban,
} from "./index";

describe("isValidIban", () => {
    it("accepts valid IBANs from several countries, with or without spaces", () => {
        expect(isValidIban("FR7630006000011234567890189")).toBe(true);
        expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
        expect(isValidIban("EE382200221020145685")).toBe(true);
        expect(isValidIban("gb82west12345698765432")).toBe(true);
    });

    it("rejects a checksum typo", () => {
        expect(isValidIban("FR7630006000011234567890188")).toBe(false);
    });

    it("rejects malformed input", () => {
        expect(isValidIban("")).toBe(false);
        expect(isValidIban("FR76")).toBe(false);
        expect(isValidIban("1234567890123456")).toBe(false);
    });
});

describe("normalizeIban / shortenIban / getIbanCountry", () => {
    it("strips whitespace and uppercases", () => {
        expect(normalizeIban(" fr76 3000 6000 ")).toBe("FR7630006000");
    });

    it("shortens to Monerium's 11-char form", () => {
        expect(shortenIban("FR76 3000 6000 0112 3456 7890 189")).toBe(
            "FR76...0189"
        );
        expect(shortenIban("FR761234567")).toBe("FR761234567");
    });

    it("returns the bank country", () => {
        expect(getIbanCountry("de89370400440532013000")).toBe("DE");
        expect(getIbanCountry("nope")).toBeNull();
    });
});

describe("normalizeRedeemAmount", () => {
    it("accepts up to two decimals and a comma separator", () => {
        expect(normalizeRedeemAmount("12,5")).toBe("12.5");
        expect(normalizeRedeemAmount(" 100 ")).toBe("100");
        expect(normalizeRedeemAmount("0.01")).toBe("0.01");
    });

    it("rejects zero, three decimals and garbage", () => {
        expect(normalizeRedeemAmount("0")).toBeNull();
        expect(normalizeRedeemAmount("1.234")).toBeNull();
        expect(normalizeRedeemAmount("1e3")).toBeNull();
        expect(normalizeRedeemAmount("-5")).toBeNull();
    });
});

describe("field rules", () => {
    it("enforces the memo length window", () => {
        expect(isValidMemo("Rent")).toBe(false);
        expect(isValidMemo("Rent!")).toBe(true);
        expect(isValidMemo("x".repeat(141))).toBe(false);
    });

    it("requires two characters per name and an alpha-2 country", () => {
        expect(isValidCounterpartName(" A ")).toBe(false);
        expect(isValidCounterpartName("Al")).toBe(true);
        expect(isValidCountryCode("FR")).toBe(true);
        expect(isValidCountryCode("fr")).toBe(false);
        expect(isValidCountryCode("FRA")).toBe(false);
    });
});

describe("redeem order message", () => {
    const at = new Date("2024-07-12T12:02:49.123Z");

    it("truncates the timestamp to the minute", () => {
        expect(formatMessageTimestamp(at)).toBe("2024-07-12T12:02:00Z");
    });

    it("builds the shortened-IBAN form Monerium documents", () => {
        expect(
            buildRedeemOrderMessage({
                amount: "1.23",
                iban: "EE12 7310 1381 5551 2606 682602",
                at,
            })
        ).toBe("Send EUR 1.23 to EE12...2602 at 2024-07-12T12:02:00Z");
    });

    it("parses what it builds", () => {
        const message = buildRedeemOrderMessage({
            amount: "40",
            iban: "FR7630006000011234567890189",
            at,
        });
        expect(parseRedeemOrderMessage(message)).toEqual({
            amount: "40",
            iban: "FR76...0189",
            timestamp: new Date("2024-07-12T12:02:00Z"),
        });
    });

    it("rejects other currencies and trailing content", () => {
        expect(
            parseRedeemOrderMessage(
                "Send GBP 1 to FR76...0189 at 2024-07-12T12:02:00Z"
            )
        ).toBeNull();
        expect(
            parseRedeemOrderMessage(
                "Send EUR 1 to FR76...0189 at 2024-07-12T12:02:00Z extra"
            )
        ).toBeNull();
    });
});

describe("isMoneriumProfileUsable", () => {
    it("requires an approved profile in production", () => {
        expect(isMoneriumProfileUsable("approved", "production")).toBe(true);
        for (const state of [
            "created",
            "incomplete",
            "pending",
            "review",
        ] as const) {
            expect(isMoneriumProfileUsable(state, "production")).toBe(false);
        }
    });

    it("accepts any open profile in sandbox, where identities are never reviewed", () => {
        for (const state of [
            "created",
            "incomplete",
            "pending",
            "review",
            "approved",
        ] as const) {
            expect(isMoneriumProfileUsable(state, "sandbox")).toBe(true);
        }
    });

    it("never accepts a missing, rejected or closed profile", () => {
        for (const environment of ["sandbox", "production"] as const) {
            expect(isMoneriumProfileUsable(null, environment)).toBe(false);
            expect(isMoneriumProfileUsable("rejected", environment)).toBe(
                false
            );
            expect(isMoneriumProfileUsable("closed", environment)).toBe(false);
        }
    });
});
