import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import { getMerchantIdMetafield } from "./metafields";
import {
    createWebPixel,
    deleteWebPixel,
    getWebPixel,
    updateWebPixelSettings,
} from "./webPixel";

vi.mock("./metafields", () => ({
    getMerchantIdMetafield: vi.fn().mockResolvedValue("test-merchant-id"),
}));

const mockGraphql = vi.fn();
const mockContext = {
    admin: { graphql: mockGraphql },
} as unknown as AuthenticatedContext;

const savedBackendUrl = process.env.BACKEND_URL;

beforeEach(() => {
    mockGraphql.mockClear();
    process.env.BACKEND_URL = "https://backend.frak.id";
});

afterEach(() => {
    process.env.BACKEND_URL = savedBackendUrl;
});

describe("getWebPixel", () => {
    it("should return web pixel data when pixel exists", async () => {
        const pixel = { id: "gid://shopify/WebPixel/1", settings: "{}" };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixel: pixel } }),
        });

        const result = await getWebPixel(mockContext);

        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql).toHaveBeenCalledWith(
            expect.stringContaining("webPixel")
        );
        expect(result).toEqual(pixel);
    });

    it("should return null when no pixel exists", async () => {
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixel: null } }),
        });

        const result = await getWebPixel(mockContext);

        expect(result).toBeNull();
    });
});

describe("createWebPixel", () => {
    it("should pass backend URL in settings", async () => {
        const pixel = { id: "gid://shopify/WebPixel/2", settings: "{}" };
        const webPixelCreate = {
            userErrors: [],
            webPixel: pixel,
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelCreate } }),
        });

        const result = await createWebPixel(mockContext);

        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql).toHaveBeenCalledWith(
            expect.stringContaining("webPixelCreate"),
            expect.objectContaining({
                variables: {
                    webPixel: {
                        settings: {
                            backendUrl: "https://backend.frak.id",
                            merchantId: "test-merchant-id",
                        },
                    },
                },
            })
        );
        expect(result.userErrors).toHaveLength(0);
        expect(result.webPixel).toEqual(pixel);
    });

    it("should not include merchantId in settings when metafield is null", async () => {
        vi.mocked(getMerchantIdMetafield).mockResolvedValueOnce(null);
        const pixel = { id: "gid://shopify/WebPixel/2", settings: "{}" };
        const webPixelCreate = {
            userErrors: [],
            webPixel: pixel,
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelCreate } }),
        });

        await createWebPixel(mockContext);

        expect(mockGraphql).toHaveBeenCalledWith(
            expect.stringContaining("webPixelCreate"),
            expect.objectContaining({
                variables: {
                    webPixel: {
                        settings: { backendUrl: "https://backend.frak.id" },
                    },
                },
            })
        );
    });

    it("should return userErrors when creation fails", async () => {
        const webPixelCreate = {
            userErrors: [{ field: "settings", message: "Invalid settings" }],
            webPixel: null,
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelCreate } }),
        });

        const result = await createWebPixel(mockContext);

        expect(result.userErrors).toHaveLength(1);
        expect(result.userErrors[0].message).toBe("Invalid settings");
    });
});

describe("updateWebPixelSettings", () => {
    it("should pass pixel id and backend URL in settings", async () => {
        const pixel = {
            id: "gid://shopify/WebPixel/1",
            settings: '{"backendUrl":"https://backend.frak.id"}',
        };
        const webPixelUpdate = {
            userErrors: [],
            webPixel: pixel,
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelUpdate } }),
        });

        const result = await updateWebPixelSettings({
            ...mockContext,
            id: "gid://shopify/WebPixel/1",
        });

        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql).toHaveBeenCalledWith(
            expect.stringContaining("webPixelUpdate"),
            expect.objectContaining({
                variables: {
                    id: "gid://shopify/WebPixel/1",
                    webPixel: {
                        settings: {
                            backendUrl: "https://backend.frak.id",
                            merchantId: "test-merchant-id",
                        },
                    },
                },
            })
        );
        expect(result.userErrors).toHaveLength(0);
        expect(result.webPixel).toEqual(pixel);
    });
});

describe("deleteWebPixel", () => {
    it("should return deleted pixel ID with no errors on success", async () => {
        const webPixelDelete = {
            deletedWebPixelId: "gid://shopify/WebPixel/1",
            userErrors: [],
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelDelete } }),
        });

        const result = await deleteWebPixel({
            ...mockContext,
            id: "gid://shopify/WebPixel/1",
        });

        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql).toHaveBeenCalledWith(
            expect.stringContaining("webPixelDelete"),
            expect.objectContaining({
                variables: { id: "gid://shopify/WebPixel/1" },
            })
        );
        expect(result.deletedWebPixelId).toBe("gid://shopify/WebPixel/1");
        expect(result.userErrors).toHaveLength(0);
    });

    it("should return userErrors when deletion fails", async () => {
        const webPixelDelete = {
            deletedWebPixelId: "",
            userErrors: [
                {
                    code: "NOT_FOUND",
                    field: "id",
                    message: "Web pixel not found",
                },
            ],
        };
        mockGraphql.mockResolvedValueOnce({
            json: () => Promise.resolve({ data: { webPixelDelete } }),
        });

        const result = await deleteWebPixel({
            ...mockContext,
            id: "gid://shopify/WebPixel/999",
        });

        expect(result.userErrors).toHaveLength(1);
        expect(result.userErrors[0].code).toBe("NOT_FOUND");
        expect(result.userErrors[0].message).toBe("Web pixel not found");
    });
});
