import { describe, expect, it } from "vitest";
import type { MoneriumOrderDto } from "../schemas";
import type { MoneriumOrderRecord } from "./MoneriumApiClient";
import { deriveBeneficiaries, toOrderDto } from "./orderMapping";

const ADDRESS = "0x0000000000000000000000000000000000000001" as const;

function order(overrides: Partial<MoneriumOrderDto> = {}): MoneriumOrderDto {
    return {
        id: crypto.randomUUID(),
        kind: "redeem",
        state: "processed",
        amount: "10",
        currency: "eur",
        chain: "arbitrum",
        address: ADDRESS,
        counterpart: {
            iban: "DE89 3704 0044 0532 0130 00",
            own: false,
            firstName: "Ada",
            lastName: "Lovelace",
            country: "DE",
        },
        placedAt: "2026-10-01T10:00:00Z",
        txHashes: [],
        ...overrides,
    };
}

describe("deriveBeneficiaries", () => {
    it("is unique by normalized IBAN and newest first", () => {
        const result = deriveBeneficiaries([
            order({ placedAt: "2026-10-01T10:00:00Z" }),
            order({
                placedAt: "2026-10-05T10:00:00Z",
                counterpart: {
                    iban: "de89370400440532013000",
                    own: false,
                    firstName: "Ada",
                    lastName: "L.",
                    country: "DE",
                },
            }),
            order({
                placedAt: "2026-10-03T10:00:00Z",
                counterpart: { iban: "FR7630006000011234567890189", own: true },
            }),
        ]);

        expect(result.map((b) => b.iban)).toEqual([
            "DE89370400440532013000",
            "FR7630006000011234567890189",
        ]);
        expect(result[0]).toMatchObject({
            lastName: "L.",
            lastUsedAt: "2026-10-05T10:00:00Z",
        });
    });

    it("keeps the own flag and leaves names off own payouts", () => {
        const [own] = deriveBeneficiaries([
            order({
                counterpart: { iban: "FR7630006000011234567890189", own: true },
            }),
        ]);
        expect(own).toEqual({
            iban: "FR7630006000011234567890189",
            own: true,
            lastUsedAt: "2026-10-01T10:00:00Z",
        });
    });

    it("skips rejected orders, issue orders and orders without an IBAN", () => {
        expect(
            deriveBeneficiaries([
                order({ state: "rejected" }),
                order({ kind: "issue" }),
                order({ counterpart: { own: false } }),
            ])
        ).toEqual([]);
    });

    it("drops third parties without a usable first and last name, keeps own payouts", () => {
        const result = deriveBeneficiaries([
            order({
                counterpart: {
                    iban: "FR7630006000011234567890189",
                    own: false,
                    companyName: "Acme SAS",
                },
            }),
            order({
                counterpart: { iban: "ES9121000418450200051332", own: false },
            }),
            order({
                counterpart: {
                    iban: "IT60X0542811101000000123456",
                    own: false,
                    firstName: "A",
                    lastName: "Lovelace",
                },
            }),
            order({
                counterpart: { iban: "NL91ABNA0417164300", own: true },
            }),
        ]);
        expect(result.map((b) => b.iban)).toEqual(["NL91ABNA0417164300"]);
    });

    it("keeps pending and placed orders", () => {
        expect(deriveBeneficiaries([order({ state: "pending" })])).toHaveLength(
            1
        );
    });

    it("caps the list at 20", () => {
        const many = Array.from({ length: 30 }, (_, index) =>
            order({
                placedAt: new Date(
                    Date.UTC(2026, 9, 1, 0, index)
                ).toISOString(),
                counterpart: {
                    iban: `FR76300060000112345678901${String(index).padStart(2, "0")}`,
                    own: false,
                    firstName: "Ada",
                    lastName: "Lovelace",
                },
            })
        );
        const result = deriveBeneficiaries(many);
        expect(result).toHaveLength(20);
        expect(result[0].lastUsedAt).toBe(many[29].placedAt);
    });
});

describe("toOrderDto", () => {
    const record: MoneriumOrderRecord = {
        id: "o-1",
        kind: "redeem",
        address: ADDRESS,
        chain: "arbitrum",
        currency: "eur",
        amount: "5",
        counterpart: {
            identifier: { standard: "iban", iban: "DE89370400440532013000" },
            details: { firstName: "Ada", lastName: "Lovelace", country: "DE" },
        },
        state: "placed",
        meta: { placedAt: "2026-10-01T10:00:00Z" },
    };

    it("flattens the counterpart and defaults txHashes", () => {
        expect(toOrderDto(record)).toEqual({
            id: "o-1",
            kind: "redeem",
            state: "placed",
            amount: "5",
            currency: "eur",
            chain: "arbitrum",
            address: ADDRESS,
            counterpart: {
                iban: "DE89370400440532013000",
                own: false,
                firstName: "Ada",
                lastName: "Lovelace",
                country: "DE",
            },
            placedAt: "2026-10-01T10:00:00Z",
            txHashes: [],
        });
    });

    it("carries own payouts, memo, rejection reason and hashes", () => {
        const dto = toOrderDto({
            ...record,
            memo: "Rent",
            state: "rejected",
            counterpart: {
                identifier: { iban: "DE89370400440532013000" },
                details: { own: true },
            },
            meta: {
                placedAt: "2026-10-01T10:00:00Z",
                rejectedReason: "Insufficient funds",
                txHashes: ["0xabc"],
            },
        });
        expect(dto).toMatchObject({
            memo: "Rent",
            rejectedReason: "Insufficient funds",
            txHashes: ["0xabc"],
            counterpart: { own: true },
        });
    });
});
