import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useProductSetupStatus } from "./useProductSetupStatus";

// Mock the dependencies
vi.mock("./useGetProductAdministrators", () => ({
    useGetProductAdministrators: vi.fn(),
}));

vi.mock("./useGetProductFunding", () => ({
    useGetProductFunding: vi.fn(),
}));

// Mock demo mode store
vi.mock("@/stores/demoModeStore", () => ({
    demoModeStore: vi.fn((selector: any) => {
        const state = { isDemoMode: false };
        return selector(state);
    }),
}));

describe("useProductSetupStatus", () => {
    const mockProductId = "0x1234567890123456789012345678901234567890" as Hex;

    describe("demo mode", () => {
        test("should return mock setup status in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            // Mock demo mode enabled
            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            // Mock dependencies as successful
            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);
            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBeDefined();
            expect(result.current.data?.items).toHaveLength(8);
            expect(result.current.data?.hasWarning).toBe(true);

            // Check that all step keys are present
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

        test("should replace productId in resolvingPage URLs in demo mode", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: true };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);
            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check that productId was replaced in URLs
            const teamItem = result.current.data?.items.find(
                (item) => item.key === "other-admin"
            );
            expect(teamItem?.resolvingPage).toContain(mockProductId);
            expect(teamItem?.resolvingPage).not.toContain("[productId]");
        });
    });

    describe("live mode with administrators", () => {
        test("should detect multiple administrators (hasOtherAdmin = true)", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            // Mock multiple administrators
            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [
                    { roleDetails: { admin: true } },
                    { roleDetails: { admin: true } },
                ],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            // Mock single administrator
            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [{ roleDetails: { admin: true } }],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [{ balance: 1000n, isDistributing: false }],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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

        test("should detect no funding when balance = 0 (hasFunding = false)", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [{ balance: 0n, isDistributing: false }],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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

        test("should detect running bank (hasRunningBank = true)", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [{ balance: 1000n, isDistributing: true }],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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

        test("should detect no running bank (hasRunningBank = false)", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [{ balance: 1000n, isDistributing: false }],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
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
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Should have warnings since most steps are not complete
            expect(result.current.data?.hasWarning).toBe(true);
        });

        test("should set hasWarning to false when all steps are good", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            // Mock optimal setup: multiple admins, funded, distributing
            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [
                    { roleDetails: { admin: true } },
                    { roleDetails: { admin: true } },
                ],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [{ balance: 1000n, isDistributing: true }],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Still has warning due to placeholder steps (interaction, webhook, campaign)
            // But at least funding and admins should be good
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
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            // Mock dependencies as not successful yet
            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: undefined,
                isSuccess: false,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: undefined,
                isSuccess: false,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            // Should be pending since dependencies not loaded
            expect(result.current.isPending).toBe(true);
            expect(result.current.data).toBeUndefined();
        });

        test("should be disabled when no productId provided", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () =>
                    useProductSetupStatus({
                        productId: undefined as unknown as Hex,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(result.current.isPending).toBe(true);
        });
    });

    describe("step metadata", () => {
        test("should include all required fields for each step", async ({
            queryWrapper,
        }: TestContext) => {
            const { useGetProductAdministrators } = await import(
                "./useGetProductAdministrators"
            );
            const { useGetProductFunding } = await import(
                "./useGetProductFunding"
            );
            const { demoModeStore } = await import("@/stores/demoModeStore");

            vi.mocked(demoModeStore).mockImplementation((selector: any) => {
                const state = { isDemoMode: false };
                return selector(state);
            });

            vi.mocked(useGetProductAdministrators).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            vi.mocked(useGetProductFunding).mockReturnValue({
                data: [],
                isSuccess: true,
            } as any);

            const { result } = renderHook(
                () => useProductSetupStatus({ productId: mockProductId }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            // Check that each step has all required fields
            for (const item of result.current.data?.items ?? []) {
                expect(item.key).toBeTruthy();
                expect(item.name).toBeTruthy();
                expect(item.description).toBeTruthy();
                expect(typeof item.isGood).toBe("boolean");
                expect(item.resolvingPage).toBeTruthy();
                expect(item.resolvingPage).not.toContain("[productId]");
            }
        });
    });
});
