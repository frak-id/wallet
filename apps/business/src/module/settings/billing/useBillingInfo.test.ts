import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import type { BillingInfo } from "./types";
import { useBillingInfo } from "./useBillingInfo";

vi.mock("@/module/common/hook/useSettingsMerchantId", () => ({
    useSettingsMerchantId: () => "merchant-1",
}));

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn(),
    },
}));

const INFO: BillingInfo = {
    companyName: "Nowa",
    vatNumber: "FR76485215479",
    streetAddress: "42 rue Legendre",
    city: "Paris",
    postalCode: "75017",
    country: "FR",
    billingEmail: "nowa@nowa-water.com",
};

const DOCS = [
    {
        id: "bill-1",
        kind: "monthly_bill" as const,
        reference: "BILL-2026-0001",
        documentDate: "2026-08-31T00:00:00.000Z",
        currency: "eure",
        grossAmount: null,
        netAmount: null,
        txHash: null,
        linkedDepositId: null,
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-09-01T00:00:00.000Z",
        pdfGeneratedAt: "2026-09-01T00:00:00.000Z",
        voidedAt: null,
        createdAt: "2026-09-01T00:00:00.000Z",
    },
    {
        id: "dep-1",
        kind: "deposit" as const,
        reference: "DEP-2026-0001",
        documentDate: "2026-07-31T00:00:00.000Z",
        currency: "eure",
        grossAmount: "1200",
        netAmount: "800",
        txHash: null,
        linkedDepositId: null,
        periodStart: null,
        periodEnd: null,
        pdfGeneratedAt: null,
        voidedAt: null,
        createdAt: "2026-07-31T00:00:00.000Z",
    },
];

const DOCS_WITH_WITHDRAW = [
    ...DOCS,
    {
        id: "wdr-1",
        kind: "withdraw" as const,
        reference: "WDR-2026-0001",
        documentDate: "2026-08-01T00:00:00.000Z",
        currency: "eure",
        grossAmount: "400",
        netAmount: "400",
        txHash: null,
        linkedDepositId: "dep-1",
        periodStart: null,
        periodEnd: null,
        pdfGeneratedAt: null,
        voidedAt: null,
        createdAt: "2026-08-01T00:00:00.000Z",
    },
];

function mockMerchant({
    accounting,
    documents,
}: {
    accounting: { data: unknown; error: unknown };
    documents: { data: unknown; error: unknown };
}) {
    const accountingGet = vi.fn().mockResolvedValue(accounting);
    const accountingPut = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
    const documentsGet = vi.fn().mockResolvedValue(documents);

    vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
        billing: {
            accounting: { get: accountingGet, put: accountingPut },
            documents: { get: documentsGet },
        },
    } as any);

    return { accountingGet, accountingPut, documentsGet };
}

describe("useBillingInfo", () => {
    test("maps accounting info and splits documents into invoices/deposits", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: { accountingInfo: INFO }, error: null },
            documents: { data: { documents: DOCS }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.hasInfo).toBe(true);
        expect(result.current.info).toEqual(INFO);
        expect(result.current.invoices).toHaveLength(1);
        expect(result.current.invoices[0]?.kind).toBe("invoice");
        expect(result.current.deposits).toHaveLength(1);
        expect(result.current.deposits[0]?.kind).toBe("deposit");
        expect(result.current.deposits[0]?.amount).toBe(1200);
        expect(result.current.deposits[0]?.hasPdf).toBe(false);
        expect(result.current.invoices[0]?.hasPdf).toBe(true);
    });

    test("hasInfo is false and info is null when accountingInfo is null", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: [] }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.info).toBeNull();
        expect(result.current.hasInfo).toBe(false);
        expect(result.current.invoices).toEqual([]);
        expect(result.current.deposits).toEqual([]);
    });

    test("saveInfo calls PUT accounting with the new info", async ({
        queryWrapper,
    }: TestContext) => {
        const { accountingPut } = mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: [] }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        result.current.saveInfo(INFO);

        await waitFor(() => expect(accountingPut).toHaveBeenCalledWith(INFO));
    });

    test("accounting.get() error: hasInfo/info fall back and isLoading settles", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: null, error: { message: "boom" } },
            documents: { data: { documents: DOCS }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.info).toBeNull();
        expect(result.current.hasInfo).toBe(false);
        // Documents query is independent and still resolves.
        expect(result.current.invoices).toHaveLength(1);
    });

    test("documents.get() error: invoices and deposits fall back to []", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: { accountingInfo: INFO }, error: null },
            documents: { data: null, error: { message: "boom" } },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.invoices).toEqual([]);
        expect(result.current.deposits).toEqual([]);
        // Accounting query is independent and still resolves.
        expect(result.current.hasInfo).toBe(true);
    });

    test("saveInfo PUT error: mutation surfaces the error and isSaving settles back to false", async ({
        queryWrapper,
    }: TestContext) => {
        const { accountingPut } = mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: [] }, error: null },
        });
        accountingPut.mockResolvedValue({
            data: null,
            error: { message: "boom" },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const onSuccess = vi.fn();
        result.current.saveInfo(INFO, { onSuccess });

        await waitFor(() => expect(accountingPut).toHaveBeenCalledWith(INFO));
        await waitFor(() => expect(result.current.isSaving).toBe(false));

        const mutations = queryWrapper.client.getMutationCache().getAll();
        expect(mutations).toHaveLength(1);
        expect(mutations[0]?.state.status).toBe("error");
        // B12: the failure must be surfaced to the sheet and the success
        // callback (which closes the sheet) must NOT have fired.
        expect(result.current.saveFailed).toBe(true);
        expect(onSuccess).not.toHaveBeenCalled();

        // resetSaveState clears the sticky error (called on sheet close).
        result.current.resetSaveState();
        await waitFor(() => expect(result.current.saveFailed).toBe(false));
    });

    test("saveInfo success invokes the onSuccess callback (sheet close hook) — B12", async ({
        queryWrapper,
    }: TestContext) => {
        const { accountingPut } = mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: [] }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const onSuccess = vi.fn();
        result.current.saveInfo(INFO, { onSuccess });

        await waitFor(() => expect(accountingPut).toHaveBeenCalledWith(INFO));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(result.current.saveFailed).toBe(false);
    });

    test("a monthly_bill document with grossAmount: null maps to amount: null (not NaN)", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: DOCS }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.invoices[0]?.amount).toBeNull();
    });

    test("a withdraw document maps to its own 'withdraw' entry kind, not 'deposit' (B16)", async ({
        queryWrapper,
    }: TestContext) => {
        mockMerchant({
            accounting: { data: { accountingInfo: null }, error: null },
            documents: { data: { documents: DOCS_WITH_WITHDRAW }, error: null },
        });

        const { result } = renderHook(() => useBillingInfo(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Still grouped under the same "deposit" tab (both deposit + withdraw
        // documents), but distinguishable by `kind`/`rawKind`.
        expect(result.current.deposits).toHaveLength(2);
        const withdrawEntry = result.current.deposits.find(
            (entry) => entry.rawKind === "withdraw"
        );
        expect(withdrawEntry?.kind).toBe("withdraw");
        const depositEntry = result.current.deposits.find(
            (entry) => entry.rawKind === "deposit"
        );
        expect(depositEntry?.kind).toBe("deposit");
    });
});
