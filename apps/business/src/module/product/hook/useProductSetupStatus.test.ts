import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useGetMerchantBank } from "./useGetMerchantBank";
import { useGetProductAdministrators } from "./useGetProductAdministrators";
import { useProductSetupStatus } from "./useProductSetupStatus";

vi.mock("./useGetProductAdministrators", () => ({
    useGetProductAdministrators: vi.fn(),
}));

vi.mock("./useGetMerchantBank", () => ({
    useGetMerchantBank: vi.fn(),
}));

const mockMerchantId = "11111111-1111-1111-1111-111111111111";

const mockBankEmpty = {
    data: {
        deployed: true,
        bankAddress: "0x1" as Address,
        isManager: true,
        isOpen: false,
        tokens: [],
    },
    isSuccess: true,
} as any;

const mockBankWithBalance = {
    data: {
        deployed: true,
        bankAddress: "0x1" as Address,
        isManager: true,
        isOpen: false,
        tokens: [
            {
                symbol: "usdc",
                address: "0x2" as Address,
                balance: 1000n,
                allowance: 0n,
            },
        ],
    },
    isSuccess: true,
} as any;

const mockBankOpen = {
    data: {
        deployed: true,
        bankAddress: "0x1" as Address,
        isManager: true,
        isOpen: true,
        tokens: [
            {
                symbol: "usdc",
                address: "0x2" as Address,
                balance: 1000n,
                allowance: 1000n,
            },
        ],
    },
    isSuccess: true,
} as any;

const mockAdminsEmpty = {
    data: [],
    isSuccess: true,
} as any;

const mockAdminsMultiple = {
    data: [{ isOwner: true }, { isOwner: true }],
    isSuccess: true,
} as any;

const mockAdminsSingle = {
    data: [{ isOwner: true }],
    isSuccess: true,
} as any;

function setupMocks(admins: any, bank: any) {
    vi.mocked(useGetProductAdministrators).mockReturnValue(admins);
    vi.mocked(useGetMerchantBank).mockReturnValue(bank);
}

describe("useProductSetupStatus", () => {
    describe("demo mode", () => {
        test("should return mock setup status in demo mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore
                .getState()
                .setAuth(
                    "demo-token",
                    "0x0000000000000000000000000000000000000000" as Address,
                    Date.now() + 1000000
                );

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(result.current.data?.items).toHaveLength(8);
            expect(result.current.data?.hasWarning).toBe(true);

            const stepKeys = result.current.data?.items.map((item) => item.key);
            expect(stepKeys).toContain("other-admin");
            expect(stepKeys).toContain("interaction-setup");
            expect(stepKeys).toContain("delegated-interaction");
            expect(stepKeys).toContain("oracle-updater-allowed");
            expect(stepKeys).toContain("webhook-setup");
            expect(stepKeys).toContain("add-funding");
            expect(stepKeys).toContain("running-bank");
            expect(stepKeys).toContain("add-campaign");
        });

        test("should replace merchantId in resolvingPage URLs in demo mode", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore
                .getState()
                .setAuth(
                    "demo-token",
                    "0x0000000000000000000000000000000000000000" as Address,
                    Date.now() + 1000000
                );

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const teamItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(teamItem?.resolvingPage).toContain(mockMerchantId);
            expect(teamItem?.resolvingPage).not.toContain("[merchantId]");
        });
    });

    describe("live mode with administrators", () => {
        test("should detect multiple administrators (hasOtherAdmin = true)", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsMultiple, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const otherAdminItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(otherAdminItem?.isGood).toBe(true);
        });

        test("should detect single administrator (hasOtherAdmin = false)", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsSingle, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const otherAdminItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(otherAdminItem?.isGood).toBe(false);
        });

        test("should handle no administrators", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const otherAdminItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(otherAdminItem?.isGood).toBe(false);
        });
    });

    describe("funding status checks", () => {
        test("should detect funding when balance > 0 (hasFunding = true)", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankWithBalance);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const fundingItem = result.current.data?.items.find(
                (item) => item.key === "add-funding"
            );
            expect(fundingItem?.isGood).toBe(true);
        });

        test("should detect no funding when no tokens have balance (hasFunding = false)", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const fundingItem = result.current.data?.items.find(
                (item) => item.key === "add-funding"
            );
            expect(fundingItem?.isGood).toBe(false);
        });

        test("should detect running bank when isOpen = true", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankOpen);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const runningBankItem = result.current.data?.items.find(
                (item) => item.key === "running-bank"
            );
            expect(runningBankItem?.isGood).toBe(true);
        });

        test("should detect no running bank when isOpen = false", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankWithBalance);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const runningBankItem = result.current.data?.items.find(
                (item) => item.key === "running-bank"
            );
            expect(runningBankItem?.isGood).toBe(false);
        });
    });

    describe("hasWarning calculation", () => {
        test("should set hasWarning to true when any step is not good", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data?.hasWarning).toBe(true);
        });

        test("should set hasWarning to false when all steps are good", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsMultiple, mockBankOpen);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            const fundingItem = result.current.data?.items.find(
                (item) => item.key === "add-funding"
            );
            const adminItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(fundingItem?.isGood).toBe(true);
            expect(adminItem?.isGood).toBe(true);
        });
    });

    describe("query enabled state", () => {
        test("should be disabled when dependencies are not loaded", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: undefined,
                isSuccess: false,
            } as any);
            vi.mocked(useGetMerchantBank).mockReturnValue({
                data: undefined,
                isSuccess: false,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should be disabled when no merchantId provided", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () =>
                    useProductSetupStatus({
                        merchantId: undefined as unknown as string,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
        });
    });

    describe("step metadata", () => {
        test("should include all required fields for each step", async ({
            queryWrapper,
            freshAuthStore,
        }: TestContext) => {
            queryWrapper.client.clear();
            freshAuthStore.getState().clearAuth();

            setupMocks(mockAdminsEmpty, mockBankEmpty);

            const { result } = renderHook(
                () => useProductSetupStatus({ merchantId: mockMerchantId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            for (const item of result.current.data?.items ?? []) {
                expect(item.key).toBeTruthy();
                expect(item.name).toBeTruthy();
                expect(item.description).toBeTruthy();
                expect(typeof item.isGood).toBe("boolean");
                expect(item.resolvingPage).toBeTruthy();
                expect(item.resolvingPage).not.toContain("[merchantId]");
            }
        });
    });
});
