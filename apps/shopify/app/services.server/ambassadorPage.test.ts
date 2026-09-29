import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import {
    createAmbassadorPage,
    findPublishedPageByTemplateSuffixes,
    resolveAmbassadorPageUrl,
} from "./ambassadorPage";

vi.mock("./shop", () => ({
    shopInfo: vi.fn().mockResolvedValue({
        primaryDomain: { url: "https://www.shop.com" },
    }),
}));

const mockGraphql = vi.fn();
const mockContext = {
    session: { shop: "test.myshopify.com" },
    admin: { graphql: mockGraphql },
} as unknown as AuthenticatedContext;

function respond(data: unknown) {
    mockGraphql.mockResolvedValueOnce({
        json: async () => ({ data }),
    });
}

function created(id: string, handle: string) {
    respond({
        pageCreate: { page: { id, handle }, userErrors: [] },
    });
}

function taken() {
    respond({
        pageCreate: {
            page: null,
            userErrors: [
                { code: "TAKEN", field: ["page", "handle"], message: "taken" },
            ],
        },
    });
}

function sentHandles(): string[] {
    return mockGraphql.mock.calls.map(
        ([, options]) => options.variables.page.handle
    );
}

beforeEach(() => {
    mockGraphql.mockReset();
});

describe("createAmbassadorPage", () => {
    it("sends the component tag as body, published, with no template suffix", async () => {
        created("gid://shopify/Page/1", "become-an-ambassador");

        const result = await createAmbassadorPage(mockContext, "en");

        expect(result).toEqual({
            id: "gid://shopify/Page/1",
            handle: "become-an-ambassador",
        });
        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql.mock.calls[0][1]).toEqual({
            variables: {
                page: {
                    title: "Become an ambassador",
                    handle: "become-an-ambassador",
                    body: "<frak-ambassador></frak-ambassador>",
                    isPublished: true,
                },
            },
        });
    });

    it("sends the French title and handle when the language is fr", async () => {
        created("gid://shopify/Page/2", "devenir-ambassadeur");

        await createAmbassadorPage(mockContext, "fr");

        expect(mockGraphql.mock.calls[0][1].variables.page).toMatchObject({
            title: "Devenir ambassadeur",
            handle: "devenir-ambassadeur",
        });
    });

    it("retries with -2 when the first handle is taken", async () => {
        taken();
        created("gid://shopify/Page/3", "become-an-ambassador-2");

        const result = await createAmbassadorPage(mockContext, "en");

        expect(sentHandles()).toEqual([
            "become-an-ambassador",
            "become-an-ambassador-2",
        ]);
        expect(result).toEqual({
            id: "gid://shopify/Page/3",
            handle: "become-an-ambassador-2",
        });
    });

    it("returns null after every handle up to -5 is taken", async () => {
        for (let i = 0; i < 5; i += 1) taken();

        const result = await createAmbassadorPage(mockContext, "en");

        expect(result).toBeNull();
        expect(sentHandles()).toEqual([
            "become-an-ambassador",
            "become-an-ambassador-2",
            "become-an-ambassador-3",
            "become-an-ambassador-4",
            "become-an-ambassador-5",
        ]);
    });
});

describe("resolveAmbassadorPageUrl", () => {
    it("returns the primary domain plus the page's current handle when published", async () => {
        respond({ page: { handle: "renamed-page", isPublished: true } });

        const url = await resolveAmbassadorPageUrl(
            mockContext,
            "gid://shopify/Page/1"
        );

        expect(url).toEqual({
            ok: true,
            url: "https://www.shop.com/pages/renamed-page",
        });
        expect(mockGraphql.mock.calls[0][1]).toEqual({
            variables: { id: "gid://shopify/Page/1" },
        });
    });

    it("returns null when the page is unpublished", async () => {
        respond({ page: { handle: "hidden", isPublished: false } });

        await expect(
            resolveAmbassadorPageUrl(mockContext, "gid://shopify/Page/1")
        ).resolves.toEqual({ ok: true, url: null });
    });

    it("returns null when the page no longer exists", async () => {
        respond({ page: null });

        await expect(
            resolveAmbassadorPageUrl(mockContext, "gid://shopify/Page/1")
        ).resolves.toEqual({ ok: true, url: null });
    });

    it("reports a failed read apart from a missing page", async () => {
        mockGraphql.mockRejectedValueOnce(new Error("network"));

        await expect(
            resolveAmbassadorPageUrl(mockContext, "gid://shopify/Page/1")
        ).resolves.toEqual({ ok: false });
    });
});

describe("findPublishedPageByTemplateSuffixes", () => {
    function pages(
        nodes: Array<{
            id: string;
            handle: string;
            isPublished: boolean;
            templateSuffix: string | null;
        }>
    ) {
        respond({ pages: { nodes } });
    }

    it("picks the most recently updated published page on the suffix", async () => {
        pages([
            {
                id: "gid://shopify/Page/9",
                handle: "other",
                isPublished: true,
                templateSuffix: null,
            },
            {
                id: "gid://shopify/Page/7",
                handle: "newest-ambassador",
                isPublished: true,
                templateSuffix: "ambassador",
            },
            {
                id: "gid://shopify/Page/5",
                handle: "older-ambassador",
                isPublished: true,
                templateSuffix: "ambassador",
            },
        ]);

        const page = await findPublishedPageByTemplateSuffixes(mockContext, [
            "ambassador",
        ]);

        expect(page).toEqual({
            id: "gid://shopify/Page/7",
            handle: "newest-ambassador",
        });
        expect(mockGraphql.mock.calls[0][1]).toEqual({
            variables: { first: 250 },
        });
    });

    it("ignores an unpublished match", async () => {
        pages([
            {
                id: "gid://shopify/Page/7",
                handle: "draft",
                isPublished: false,
                templateSuffix: "ambassador",
            },
            {
                id: "gid://shopify/Page/5",
                handle: "live",
                isPublished: true,
                templateSuffix: "ambassador",
            },
        ]);

        const page = await findPublishedPageByTemplateSuffixes(mockContext, [
            "ambassador",
        ]);

        expect(page).toEqual({ id: "gid://shopify/Page/5", handle: "live" });
    });

    it("returns null when no published page uses the suffixes", async () => {
        pages([
            {
                id: "gid://shopify/Page/7",
                handle: "draft",
                isPublished: false,
                templateSuffix: "ambassador",
            },
        ]);

        await expect(
            findPublishedPageByTemplateSuffixes(mockContext, ["ambassador"])
        ).resolves.toBeNull();
    });
});
