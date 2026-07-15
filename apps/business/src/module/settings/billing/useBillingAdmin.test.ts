import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/api/backendClient";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import {
    maskIban,
    useCreateDeposit,
    useCreateWithdraw,
    useVoidDocument,
} from "./useBillingAdmin";

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: vi.fn(),
    },
}));

describe("maskIban", () => {
    test("keeps the country code and last 3 chars, masks the rest", () => {
        expect(maskIban("FR7630006000011234567890189")).toBe(
            "FR76 **** **** **** 189"
        );
    });

    test("strips spaces and uppercases before masking", () => {
        expect(maskIban("fr76 3000 6000 0112 3456 7890 189")).toBe(
            "FR76 **** **** **** 189"
        );
    });

    test("fully redacts input shorter than 8 chars", () => {
        expect(maskIban("FR76")).toBe("**** **** **** ****");
    });

    it("keeps the real country+check digits (not a hardcoded FR76)", () => {
        expect(maskIban("DE89370400440532013000")).toBe(
            "DE89 **** **** **** 000"
        );
    });

    test("never throws on garbage input", () => {
        expect(() => maskIban("")).not.toThrow();
        expect(() => maskIban("not-an-iban-at-all")).not.toThrow();
    });
});

describe("useCreateDeposit", () => {
    test("posts the deposit body and invalidates the documents query", async ({
        queryWrapper,
    }: TestContext) => {
        const post = vi
            .fn()
            .mockResolvedValue({ data: { id: "dep-1" }, error: null });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: { deposits: { post } },
        } as any);
        const invalidateSpy = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useCreateDeposit("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        const input = {
            grossAmount: "1200",
            currency: "eure" as const,
            documentDate: "2026-07-01T00:00:00.000Z",
            country: "FR",
        };
        result.current.mutate(input);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(post).toHaveBeenCalledWith(input);
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["billing", "documents", "merchant-1"],
        });
    });

    test("surfaces a POST error", async ({ queryWrapper }: TestContext) => {
        const post = vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "boom" } });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: { deposits: { post } },
        } as any);

        const { result } = renderHook(() => useCreateDeposit("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.mutate({
            grossAmount: "1200",
            currency: "eure",
            documentDate: "2026-07-01T00:00:00.000Z",
            country: "FR",
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
    });
});

describe("useCreateWithdraw", () => {
    test("posts the withdraw body and invalidates the documents query", async ({
        queryWrapper,
    }: TestContext) => {
        const post = vi
            .fn()
            .mockResolvedValue({ data: { id: "wdr-1" }, error: null });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: { withdrawals: { post } },
        } as any);
        const invalidateSpy = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useCreateWithdraw("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        const input = {
            remainingBankAmount: "400",
            currency: "eure" as const,
            documentDate: "2026-08-01T00:00:00.000Z",
            linkedDepositId: "dep-1",
            rawIban: maskIban("FR7630006000011234567890189"),
        };
        result.current.mutate(input);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({
                linkedDepositId: "dep-1",
                rawIban: "FR76 **** **** **** 189",
            })
        );
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["billing", "documents", "merchant-1"],
        });
    });
});

describe("useVoidDocument", () => {
    test("routes a deposit void to the deposits endpoint", async ({
        queryWrapper,
    }: TestContext) => {
        const del = vi.fn().mockResolvedValue({ data: null, error: null });
        const depositsById = vi.fn().mockReturnValue({ delete: del });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: {
                deposits: depositsById,
                withdrawals: vi.fn(),
            },
        } as any);

        const { result } = renderHook(() => useVoidDocument("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.mutate({ id: "dep-1", kind: "deposit" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(depositsById).toHaveBeenCalledWith({ id: "dep-1" });
        expect(del).toHaveBeenCalled();
    });

    test("routes a withdraw void to the withdrawals endpoint", async ({
        queryWrapper,
    }: TestContext) => {
        const del = vi.fn().mockResolvedValue({ data: null, error: null });
        const withdrawalsById = vi.fn().mockReturnValue({ delete: del });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: {
                deposits: vi.fn(),
                withdrawals: withdrawalsById,
            },
        } as any);

        const { result } = renderHook(() => useVoidDocument("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.mutate({ id: "wdr-1", kind: "withdraw" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(withdrawalsById).toHaveBeenCalledWith({ id: "wdr-1" });
        expect(del).toHaveBeenCalled();
    });

    test("invalidates the documents query on success", async ({
        queryWrapper,
    }: TestContext) => {
        const del = vi.fn().mockResolvedValue({ data: null, error: null });
        vi.mocked(authenticatedBackendApi.merchant).mockReturnValue({
            billing: {
                deposits: vi.fn().mockReturnValue({ delete: del }),
            },
        } as any);
        const invalidateSpy = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useVoidDocument("merchant-1"), {
            wrapper: queryWrapper.wrapper,
        });

        result.current.mutate({ id: "dep-1", kind: "deposit" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: ["billing", "documents", "merchant-1"],
        });
    });
});
