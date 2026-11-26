import { describe, expect, it } from "vitest";
import {
    type BudgetToken,
    getTokenStatus,
    splitTokensByFunding,
    statusBadgeVariant,
} from "./budgetTokens";

describe("getTokenStatus", () => {
    it("returns empty when balance is zero", () => {
        expect(getTokenStatus(0n, 0n)).toBe("empty");
        expect(getTokenStatus(0n, 100n)).toBe("empty");
    });

    it("returns stopped when funded but allowance is zero", () => {
        expect(getTokenStatus(100n, 0n)).toBe("stopped");
    });

    it("returns warning when allowance is below balance", () => {
        expect(getTokenStatus(100n, 50n)).toBe("warning");
    });

    it("returns active when allowance covers the balance", () => {
        expect(getTokenStatus(100n, 100n)).toBe("active");
        expect(getTokenStatus(100n, 200n)).toBe("active");
    });
});

describe("statusBadgeVariant", () => {
    it("never paints an owner choice as an error", () => {
        expect(statusBadgeVariant.paused).toBe("neutral");
        expect(statusBadgeVariant.stopped).toBe("neutral");
    });

    it("keeps the limit warning amber and a healthy bank green", () => {
        expect(statusBadgeVariant.warning).toBe("warning");
        expect(statusBadgeVariant.active).toBe("success");
    });
});

describe("splitTokensByFunding", () => {
    const token = (balance: bigint): BudgetToken => ({
        symbol: "eure",
        address: "0x0000000000000000000000000000000000000000",
        balance,
        allowance: 0n,
    });

    it("splits funded and empty tokens", () => {
        const { funded, empty } = splitTokensByFunding([
            token(100n),
            token(0n),
            token(5n),
        ]);
        expect(funded).toHaveLength(2);
        expect(empty).toHaveLength(1);
    });
});
