import { vi } from "vitest";
import {
    createMockAddress,
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

// Mock the dependencies
vi.mock("@/context/api/indexerApi", () => ({
    indexerApi: {
        get: vi.fn(),
    },
}));

vi.mock("@/context/auth/session", () => ({
    getSession: vi.fn(),
}));

describe("product roles action", () => {
    describe("getRolesOnProductInternal", () => {
        test("should return undefined when productId is not provided", async () => {
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const result = await getRolesOnProductInternal({ productId: "" });

            expect(result).toBeUndefined();
        });

        test("should throw error when no session found", async () => {
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            vi.mocked(getSession).mockResolvedValue(null);

            await expect(
                getRolesOnProductInternal({ productId: "0xproduct" })
            ).rejects.toThrow("No current session found");
        });

        test("should call indexer API with correct wallet address", async ({
            mockAuthSession,
        }: TestContext) => {
            const { indexerApi } = await import("@/context/api/indexerApi");
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const productId = createMockAddress("product123");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            vi.mocked(indexerApi.get).mockReturnValue({
                json: vi.fn().mockResolvedValue([
                    {
                        id: productId,
                        isOwner: true,
                        roles: "0",
                    },
                ]),
            } as any);

            await getRolesOnProductInternal({ productId });

            expect(indexerApi.get).toHaveBeenCalledWith(
                `admin/${mockAuthSession.wallet}/products`
            );
        });

        test("should return undefined when product not found", async ({
            mockAuthSession,
        }: TestContext) => {
            const { indexerApi } = await import("@/context/api/indexerApi");
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const productId = createMockAddress("product");
            const differentId = createMockAddress("different");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            vi.mocked(indexerApi.get).mockReturnValue({
                json: vi.fn().mockResolvedValue([
                    {
                        id: differentId,
                        isOwner: false,
                        roles: "0",
                    },
                ]),
            } as any);

            const result = await getRolesOnProductInternal({ productId });

            expect(result).toBeUndefined();
        });

        test("should parse roles correctly for owner", async ({
            mockAuthSession,
        }: TestContext) => {
            const { indexerApi } = await import("@/context/api/indexerApi");
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const productId = createMockAddress("product");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            vi.mocked(indexerApi.get).mockReturnValue({
                json: vi.fn().mockResolvedValue([
                    {
                        id: productId,
                        isOwner: true,
                        roles: "0",
                    },
                ]),
            } as any);

            const result = await getRolesOnProductInternal({ productId });

            expect(result).toEqual({
                isCampaignManager: true,
                isOwner: true,
            });
        });

        test("should parse roles correctly for non-owner with roles", async ({
            mockAuthSession,
        }: TestContext) => {
            const { indexerApi } = await import("@/context/api/indexerApi");
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const productId = createMockAddress("product");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            vi.mocked(indexerApi.get).mockReturnValue({
                json: vi.fn().mockResolvedValue([
                    {
                        id: productId,
                        isOwner: false,
                        roles: "123",
                    },
                ]),
            } as any);

            const result = await getRolesOnProductInternal({ productId });

            expect(result).toEqual({
                isCampaignManager: true,
                isOwner: false,
            });
        });

        test("should parse roles correctly for non-owner without roles", async ({
            mockAuthSession,
        }: TestContext) => {
            const { indexerApi } = await import("@/context/api/indexerApi");
            const { getSession } = await import("@/context/auth/session");
            const { getRolesOnProductInternal } = await import(
                "@/context/product/action/roles"
            );

            const productId = createMockAddress("product");

            vi.mocked(getSession).mockResolvedValue(mockAuthSession);

            vi.mocked(indexerApi.get).mockReturnValue({
                json: vi.fn().mockResolvedValue([
                    {
                        id: productId,
                        isOwner: false,
                        roles: "0",
                    },
                ]),
            } as any);

            const result = await getRolesOnProductInternal({ productId });

            expect(result).toEqual({
                isCampaignManager: false,
                isOwner: false,
            });
        });
    });
});
