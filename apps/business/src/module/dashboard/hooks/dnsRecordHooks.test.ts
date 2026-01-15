import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import {
    useCheckDomainName,
    useDnsTxtRecordToSet,
    useListenToDomainNameSetup,
} from "./dnsRecordHooks";

// Mock the business API with merchant routes
vi.mock("@/context/api/backendClient", () => {
    const mockRegister = {
        "dns-txt": {
            get: vi.fn(),
        },
        verify: {
            get: vi.fn(),
        },
    };
    return {
        authenticatedBackendApi: {
            merchant: {
                register: mockRegister,
            },
        },
    };
});

describe("dnsRecordHooks", () => {
    describe("useDnsTxtRecordToSet", () => {
        test("should fetch DNS TXT record for valid domain", async ({
            queryWrapper,
        }: TestContext) => {
            const mockDnsTxt = "_frak-verification=abc123";
            const mockGet = vi.fn().mockResolvedValue({
                data: { dnsTxt: mockDnsTxt },
                error: null,
            } as any);

            vi.mocked(
                authenticatedBackendApi.merchant.register["dns-txt"].get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "example.com",
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(mockDnsTxt);
            expect(mockGet).toHaveBeenCalledWith({
                query: { domain: "example.com" },
            });
        });

        test("should not fetch when domain is undefined", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn();

            vi.mocked(
                authenticatedBackendApi.merchant.register["dns-txt"].get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: undefined,
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            // Give it a moment to ensure no fetch happens
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Query should be disabled when domain is undefined
            expect(result.current.fetchStatus).toBe("idle");
            expect(mockGet).not.toHaveBeenCalled();
        });

        test("should not fetch when disabled", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn();

            vi.mocked(
                authenticatedBackendApi.merchant.register["dns-txt"].get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "example.com",
                        enabled: false,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            // Give it a moment to ensure no fetch happens
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Query should be disabled
            expect(result.current.fetchStatus).toBe("idle");
            expect(mockGet).not.toHaveBeenCalled();
        });

        test("should return empty string when API returns null data", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: null,
                error: null,
            } as any);

            vi.mocked(
                authenticatedBackendApi.merchant.register["dns-txt"].get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "example.com",
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe("");
        });
    });

    describe("useCheckDomainName", () => {
        test("should return valid domain status", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyRegistered: false,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            const response = await result.current.mutateAsync({
                domain: "example.com",
            });

            expect(response.isDomainValid).toBe(true);
            expect(response.isAlreadyRegistered).toBe(false);
            expect(mockGet).toHaveBeenCalledWith({
                query: { domain: "example.com", setupCode: undefined },
            });
        });

        test("should return already registered status", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: false,
                    isAlreadyRegistered: true,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            const response = await result.current.mutateAsync({
                domain: "registered.com",
            });

            expect(response.isDomainValid).toBe(false);
            expect(response.isAlreadyRegistered).toBe(true);
        });

        test("should pass setupCode when provided", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyRegistered: false,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                domain: "example.com",
                setupCode: "SETUP123",
            });

            expect(mockGet).toHaveBeenCalledWith({
                query: { domain: "example.com", setupCode: "SETUP123" },
            });
        });

        test("should throw on API error", async ({
            queryWrapper,
        }: TestContext) => {
            const mockError = { status: 500, value: "Server error" };
            const mockGet = vi.fn().mockResolvedValue({
                data: null,
                error: mockError,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({ domain: "example.com" })
            ).rejects.toEqual(mockError);
        });
    });

    describe("useListenToDomainNameSetup", () => {
        test("should return true when domain is valid and not registered", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyRegistered: false,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "example.com",
                        setupCode: "SETUP123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(true);
        });

        test("should return false when domain is already registered", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyRegistered: true,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "registered.com",
                        setupCode: "SETUP123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
        });

        test("should return false when domain is invalid", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: {
                    isDomainValid: false,
                    isAlreadyRegistered: false,
                },
                error: null,
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "invalid.com",
                        setupCode: "SETUP123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
        });

        test("should return false on API error", async ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn().mockResolvedValue({
                data: null,
                error: "Network error",
            });

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "example.com",
                        setupCode: "SETUP123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
        });

        test("should not fetch when domain is empty", ({
            queryWrapper,
        }: TestContext) => {
            const mockGet = vi.fn();

            vi.mocked(
                authenticatedBackendApi.merchant.register.verify.get
            ).mockImplementation(mockGet);

            renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "",
                        setupCode: "SETUP123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            expect(mockGet).not.toHaveBeenCalled();
        });
    });
});
