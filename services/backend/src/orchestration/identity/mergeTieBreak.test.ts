import { describe, expect, it } from "vitest";
import type { WeightDimensions } from "./IdentityWeightService";
import { pickHeavierWeight } from "./IdentityWeightService";
import { pickWinner } from "./WalletMergeOrchestrator";

/**
 * Regression test for the merge tie-break unification: `WalletMergeOrchestrator`
 * (authenticated wallet-to-wallet merge) and `IdentityWeightService`
 * (anonymous-id/wallet merge, via `determineAnchor`) used to run two
 * different tie-break rules on a weighted-total tie — `createdAt` on one
 * side, a per-dimension comparison on the other. Both now delegate to
 * `pickHeavierWeight`, so a tie resolves identically regardless of which
 * merge path decided it.
 */

function dims(overrides: Partial<WeightDimensions>): WeightDimensions {
    return {
        assetsCount: 0,
        referralsCount: 0,
        interactionsCount: 0,
        merchantOwnershipsCount: 0,
        merchantAdminshipsCount: 0,
        ...overrides,
    };
}

describe("pickHeavierWeight", () => {
    it("picks the higher weighted total", () => {
        const heavy = dims({ assetsCount: 5 });
        const light = dims({ assetsCount: 1 });
        expect(pickHeavierWeight(heavy, light)).toBe(heavy);
        expect(pickHeavierWeight(light, heavy)).toBe(heavy);
    });

    it("weights merchant roles 10x over activity counters", () => {
        const owner = dims({ merchantOwnershipsCount: 1 });
        const veryActive = dims({
            assetsCount: 9,
            referralsCount: 9,
            interactionsCount: 9,
        });
        // 27 activity units vs 10 for a single ownership: activity wins here,
        // pinning the multiplier value rather than just its existence.
        expect(pickHeavierWeight(owner, veryActive)).toBe(veryActive);

        const twoOwnerships = dims({ merchantOwnershipsCount: 2 });
        // 20 > 27 is false, so bump to a total that must dominate.
        const barelyActive = dims({ assetsCount: 5 });
        expect(pickHeavierWeight(twoOwnerships, barelyActive)).toBe(
            twoOwnerships
        );
    });

    it("on a total tie, breaks by merchant ownerships first", () => {
        // Equal totals (1*10 == 10 assets), ownership wins per the priority order.
        const ownerNoActivity = dims({ merchantOwnershipsCount: 1 });
        const noOwnerTenAssets = dims({ assetsCount: 10 });
        expect(pickHeavierWeight(ownerNoActivity, noOwnerTenAssets)).toBe(
            ownerNoActivity
        );
    });

    it("falls through the priority order: adminships, then assets, then referrals, then interactions", () => {
        const admin = dims({ merchantAdminshipsCount: 1 });
        const asset = dims({ assetsCount: 10 }); // ties total (10) with admin
        expect(pickHeavierWeight(admin, asset)).toBe(admin);

        const moreAssets = dims({ assetsCount: 2 });
        const moreReferrals = dims({ referralsCount: 2 });
        expect(pickHeavierWeight(moreAssets, moreReferrals)).toBe(moreAssets);

        const moreReferrals2 = dims({ referralsCount: 1 });
        const moreInteractions = dims({ interactionsCount: 1 });
        expect(pickHeavierWeight(moreReferrals2, moreInteractions)).toBe(
            moreReferrals2
        );
    });

    it("on an exact tie across every dimension, the first argument wins", () => {
        const a = dims({});
        const b = dims({});
        expect(pickHeavierWeight(a, b)).toBe(a);
        expect(pickHeavierWeight(b, a)).toBe(b);
    });
});

describe("pickWinner (WalletMergeOrchestrator) matches pickHeavierWeight", () => {
    it("requester wins when strictly heavier", () => {
        const requester = { weight: dims({ assetsCount: 5 }) };
        const target = { weight: dims({ assetsCount: 1 }) };
        expect(pickWinner(requester, target)).toBe(true);
        expect(pickWinner(target, requester)).toBe(false);
    });

    it("on a dimension tie, defers to the same per-dimension order as the anonymous-merge path", () => {
        // Equal totals (10 vs 10), requester wins on merchant ownerships —
        // the dimension IdentityWeightService's tie-break checks first.
        const requester = { weight: dims({ merchantOwnershipsCount: 1 }) };
        const target = { weight: dims({ assetsCount: 10 }) };
        expect(pickWinner(requester, target)).toBe(true);
        expect(pickWinner(target, requester)).toBe(false);
    });

    it("on a full tie, the requester (first argument) wins", () => {
        const requester = { weight: dims({}) };
        const target = { weight: dims({}) };
        expect(pickWinner(requester, target)).toBe(true);
    });
});
