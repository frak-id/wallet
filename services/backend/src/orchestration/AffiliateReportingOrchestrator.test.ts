import { describe, expect, it, vi } from "vitest";
import type { AffiliateAttributionRepository } from "../domain/affiliate/repositories/AffiliateAttributionRepository";
import type { AffiliateBrandRepository } from "../domain/affiliate/repositories/AffiliateBrandRepository";
import type {
    TakeAdsAction,
    TakeAdsClick,
} from "../infrastructure/integrations/takeads";
import { AffiliateReportingOrchestrator } from "./AffiliateReportingOrchestrator";

vi.mock("@backend-infrastructure", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const brand = {
    id: "b1",
    merchantId: "m1",
    provider: "takeads" as const,
    externalId: "123",
    trackingLink: "https://go.takeads.com/brand",
    createdAt: new Date(),
    updatedAt: new Date(),
};

function action(overrides: Partial<TakeAdsAction>): TakeAdsAction {
    return {
        actionId: "a1",
        merchantId: 123,
        status: "CONFIRMED",
        subId: "tok",
        orderAmount: 10,
        publisherRevenue: 1,
        currencyCode: "EUR",
        type: "SALE",
        orderDate: "2024-05-10T00:00:00.000Z",
        createdAt: "2024-05-10T00:00:00.000Z",
        updatedAt: "2024-05-10T00:00:00.000Z",
        countryCode: "FR",
        ...overrides,
    };
}

function click(overrides: Partial<TakeAdsClick>): TakeAdsClick {
    return {
        id: 1,
        adspaceId: "as1",
        adspaceName: "Adspace",
        programId: "p1",
        programName: "Program",
        subId: "tok",
        date: "2024-05-10",
        count: 5,
        productId: "MONETIZE_API",
        updatedAt: "2024-05-10T00:00:00.000Z",
        ...overrides,
    };
}

function build({
    actions = [] as TakeAdsAction[],
    clicks = [] as TakeAdsClick[],
    tokens = new Set<string>(["tok"]),
    linkedBrand = brand as Awaited<
        ReturnType<AffiliateBrandRepository["findByMerchantId"]>
    >,
} = {}) {
    const brandRepo = {
        findByMerchantId: vi.fn().mockResolvedValue(linkedBrand),
    } as unknown as AffiliateBrandRepository;
    const attributionRepo = {
        listTokensByMerchant: vi.fn().mockResolvedValue(tokens),
    } as unknown as AffiliateAttributionRepository;
    const getActions = vi
        .fn()
        .mockResolvedValue({ meta: { next: null }, data: actions });
    const getClicks = vi.fn().mockResolvedValue({
        meta: { total: clicks.length },
        data: clicks,
    });
    const orchestrator = new AffiliateReportingOrchestrator(
        brandRepo,
        attributionRepo,
        () => ({ getActions, getClicks })
    );
    return { orchestrator, getActions, getClicks };
}

const window = { from: "2024-05-01", to: "2024-05-30" };

describe("AffiliateReportingOrchestrator", () => {
    it("returns null when the merchant has no affiliate brand", async () => {
        const { orchestrator } = build({ linkedBrand: null });
        expect(await orchestrator.getReport("m1", window)).toBeNull();
    });

    it("aggregates actions by status, type and currency", async () => {
        const { orchestrator } = build({
            actions: [
                action({ actionId: "a1", status: "CONFIRMED", type: "SALE" }),
                action({
                    actionId: "a2",
                    status: "CANCELED",
                    type: "SALE",
                    orderAmount: 20,
                    publisherRevenue: 2,
                }),
                action({
                    actionId: "a3",
                    status: "PENDING",
                    type: "LEAD",
                    currencyCode: "USD",
                    orderAmount: 5,
                    publisherRevenue: 1,
                }),
            ],
        });

        const report = await orchestrator.getReport("m1", window);

        expect(report?.actions.total).toBe(3);
        expect(report?.actions.byStatus).toMatchObject({
            confirmed: 1,
            canceled: 1,
            pending: 1,
        });
        expect(report?.actions.byType).toMatchObject({ sale: 2, lead: 1 });
        const eur = report?.actions.revenue.find(
            (r) => r.currencyCode === "EUR"
        );
        expect(eur).toMatchObject({ orderAmount: 30, publisherRevenue: 3 });
        expect(
            report?.actions.revenue.find((r) => r.currencyCode === "USD")
        ).toMatchObject({ orderAmount: 5, publisherRevenue: 1 });
    });

    it("passes the brand externalId as the actions merchant filter", async () => {
        const { orchestrator, getActions } = build({ actions: [] });
        await orchestrator.getReport("m1", window);
        expect(getActions).toHaveBeenCalledWith(
            expect.objectContaining({ merchantId: 123 })
        );
    });

    it("only counts clicks whose subId maps to the merchant", async () => {
        const { orchestrator } = build({
            tokens: new Set(["tok"]),
            clicks: [
                click({ subId: "tok", count: 5, date: "2024-05-10" }),
                click({ subId: "tok", count: 3, date: "2024-05-11" }),
                click({ subId: "other", count: 99, date: "2024-05-12" }),
                click({ subId: null, count: 7, date: "2024-05-13" }),
            ],
        });

        const report = await orchestrator.getReport("m1", window);

        expect(report?.clicks.total).toBe(8);
        expect(report?.clicks.series).toEqual([
            { date: "2024-05-10", count: 5 },
            { date: "2024-05-11", count: 3 },
        ]);
    });

    it("skips the clicks API entirely when the merchant has no tokens", async () => {
        const { orchestrator, getClicks } = build({
            tokens: new Set(),
            clicks: [click({})],
        });

        const report = await orchestrator.getReport("m1", window);

        expect(getClicks).not.toHaveBeenCalled();
        expect(report?.clicks.total).toBe(0);
    });
});
