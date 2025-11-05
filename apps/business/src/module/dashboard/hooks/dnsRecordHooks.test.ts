import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
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

// Mock the business API
vi.mock("@frak-labs/client/server", () => ({
    businessApi: {
        product: {
            mint: {
                dnsTxt: {
                    get: vi.fn(),
                },
                verify: {
                    get: vi.fn(),
                },
            },
        },
    },
}));

describe("dnsRecordHooks", () => {
    describe("useDnsTxtRecordToSet", () => {
        test("should fetch DNS TXT record for valid domain", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockDnsTxt = "_frak-verification=abc123";
            vi.mocked(businessApi.product.mint.dnsTxt.get).mockResolvedValue({
                data: mockDnsTxt,
                error: null,
            } as any);

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
            expect(businessApi.product.mint.dnsTxt.get).toHaveBeenCalledWith({
                query: { domain: "example.com" },
            });
        });

        test("should not fetch when domain is undefined", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockClear();

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
            expect(businessApi.product.mint.dnsTxt.get).not.toHaveBeenCalled();
        });

        test("should not fetch when disabled", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockClear();

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

            // Should not trigger the query
            expect(result.current.fetchStatus).toBe("idle");
            expect(businessApi.product.mint.dnsTxt.get).not.toHaveBeenCalled();
        });

        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockResolvedValue({
                data: "test",
                error: null,
            } as any);

            renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "test.com",
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                const queries = queryWrapper.client
                    .getQueryCache()
                    .findAll({ queryKey: ["mint", "dns-record", "test.com"] });
                expect(queries.length).toBe(1);
            });
        });

        test("should handle API returning null data", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockResolvedValue({
                data: null,
                error: null,
            } as any);

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
        test("should verify domain successfully", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            const mockVerifyData = {
                isDomainValid: true,
                isAlreadyMinted: false,
            };

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: mockVerifyData,
                error: null,
            } as any);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                domain: "example.com",
                setupCode: "code123",
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toEqual(mockVerifyData);
            expect(businessApi.product.mint.verify.get).toHaveBeenCalledWith({
                query: { domain: "example.com", setupCode: "code123" },
            });
        });

        test("should verify domain without setup code", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: { isDomainValid: false, isAlreadyMinted: true },
                error: null,
            } as any);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                domain: "taken.com",
            });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(businessApi.product.mint.verify.get).toHaveBeenCalledWith({
                query: { domain: "taken.com", setupCode: undefined },
            });
        });

        test("should throw error when API returns error", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: null,
                error: "Domain verification failed",
            } as any);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    domain: "error.com",
                })
            ).rejects.toThrow("Domain verification failed");
        });

        test("should handle multiple verification calls", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get)
                .mockResolvedValueOnce({
                    data: { isDomainValid: false },
                    error: null,
                } as any)
                .mockResolvedValueOnce({
                    data: { isDomainValid: true },
                    error: null,
                } as any);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            const firstResult = await result.current.mutateAsync({
                domain: "test1.com",
            });
            expect(firstResult?.isDomainValid).toBe(false);

            const secondResult = await result.current.mutateAsync({
                domain: "test2.com",
            });
            expect(secondResult?.isDomainValid).toBe(true);
        });
    });

    describe("useListenToDomainNameSetup", () => {
        test("should return true when domain is valid and not minted", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyMinted: false,
                },
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "example.com",
                        setupCode: "code123",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(true);
        });

        test("should return false when domain is already minted", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: {
                    isDomainValid: true,
                    isAlreadyMinted: true,
                },
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "taken.com",
                        setupCode: "code456",
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
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: {
                    isDomainValid: false,
                    isAlreadyMinted: false,
                },
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "invalid.com",
                        setupCode: "code789",
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
            const { businessApi } = await import("@frak-labs/client/server");

            const consoleWarnSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: null,
                error: "API error",
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "error.com",
                        setupCode: "code000",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Error while listening to domain name setup",
                "API error"
            );

            consoleWarnSpy.mockRestore();
        });

        test("should use correct query key", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: { isDomainValid: true },
                error: null,
            } as any);

            renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "test.com",
                        setupCode: "abc",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                const queries = queryWrapper.client.getQueryCache().findAll({
                    queryKey: [
                        "mint",
                        "listen-to-domain-name-setup",
                        "test.com",
                        "abc",
                    ],
                });
                expect(queries.length).toBe(1);
            });
        });

        test("should be enabled when domain is provided", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: { isDomainValid: true },
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "example.com",
                        setupCode: "code",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.fetchStatus).not.toBe("idle");
            });
        });

        test("should handle missing setupCode", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: { isDomainValid: true },
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "example.com",
                        setupCode: "",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(businessApi.product.mint.verify.get).toHaveBeenCalledWith({
                query: { domain: "example.com", setupCode: "" },
            });
        });
    });

    describe("edge cases and error scenarios", () => {
        test("useDnsTxtRecordToSet should handle network timeout", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockImplementation(
                () =>
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Timeout")), 100)
                    )
            );

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "slow.com",
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });

        test("useDnsTxtRecordToSet should handle empty domain string", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.dnsTxt.get).mockClear();

            const { result } = renderHook(
                () =>
                    useDnsTxtRecordToSet({
                        domain: "",
                        enabled: true,
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(result.current.fetchStatus).toBe("idle");
            expect(businessApi.product.mint.dnsTxt.get).not.toHaveBeenCalled();
        });

        test("useCheckDomainName should handle missing data field", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: null,
                error: null,
            } as any);

            const { result } = renderHook(() => useCheckDomainName(), {
                wrapper: queryWrapper.wrapper,
            });

            await result.current.mutateAsync({
                domain: "test.com",
            });

            // TanStack Query mutations return undefined when data is null
            expect(result.current.data).toBeUndefined();
        });

        test("useListenToDomainNameSetup should handle null isDomainValid", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: {
                    isDomainValid: null,
                    isAlreadyMinted: false,
                } as any,
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "test.com",
                        setupCode: "code",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
        });

        test("useListenToDomainNameSetup should handle undefined data", async ({
            queryWrapper,
        }: TestContext) => {
            const { businessApi } = await import("@frak-labs/client/server");

            vi.mocked(businessApi.product.mint.verify.get).mockResolvedValue({
                data: undefined,
                error: null,
            } as any);

            const { result } = renderHook(
                () =>
                    useListenToDomainNameSetup({
                        domain: "test.com",
                        setupCode: "code",
                    }),
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });

            expect(result.current.data).toBe(false);
        });
    });
});
