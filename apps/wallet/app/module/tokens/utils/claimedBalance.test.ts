import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import { addClaims, includesClaims } from "./claimedBalance";

const token = currentStablecoins.eure;
const oneEur = 10n ** 18n;
const claim = { token, amount: oneEur, decimals: 18 };

function balance(raw: bigint) {
    const eur = Number(raw / oneEur);
    return {
        total: { amount: eur, eurAmount: eur, usdAmount: 0, gbpAmount: 0 },
        balances: raw
            ? [
                  {
                      token,
                      name: "Monerium EURe",
                      symbol: "EURe",
                      decimals: 18,
                      rawBalance: `0x${raw.toString(16)}` as const,
                      amount: eur,
                      eurAmount: eur,
                      usdAmount: 0,
                      gbpAmount: 0,
                  },
              ]
            : [],
    };
}

describe("addClaims", () => {
    it("adds the claimed euros to the total and to the token held", () => {
        const next = addClaims(balance(2n * oneEur), [claim]);

        expect(next.total).toMatchObject({ amount: 3, eurAmount: 3 });
        expect(next.balances).toEqual([
            expect.objectContaining({
                symbol: "EURe",
                name: "Monerium EURe",
                amount: 3,
                eurAmount: 3,
                rawBalance: `0x${(3n * oneEur).toString(16)}`,
            }),
        ]);
    });

    it("lists a token the wallet did not hold yet", () => {
        const next = addClaims(balance(0n), [claim]);

        expect(next.balances).toEqual([
            expect.objectContaining({ token, symbol: "EURe", amount: 1 }),
        ]);
    });
});

describe("includesClaims", () => {
    it("rejects a balance read before the claim landed", () => {
        expect(includesClaims(balance(0n), balance(0n), [claim])).toBe(false);
    });

    it("accepts a balance that grew by the claimed amount", () => {
        expect(includesClaims(balance(oneEur), balance(0n), [claim])).toBe(
            true
        );
    });

    it("counts a token missing from the cache as zero", () => {
        expect(includesClaims(balance(oneEur), undefined, [claim])).toBe(true);
    });

    it("matches the token whatever its address casing", () => {
        const lower = [
            { ...claim, token: token.toLowerCase() as `0x${string}` },
        ];
        expect(includesClaims(balance(oneEur), null, lower)).toBe(true);
    });
});
