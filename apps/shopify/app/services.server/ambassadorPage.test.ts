import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import {
    applyAmbassadorTemplate,
    createAmbassadorPage,
    createAndRecordAmbassadorPage,
    findPublishedPageByTemplateSuffixes,
    keepStandardLayout,
    linkAmbassadorPage,
    normalizeAmbassadorPageLanguage,
    reconcileAmbassadorPage,
    resolveAmbassadorPageUrl,
    restoreAmbassadorComponent,
} from "./ambassadorPage";
import {
    getAmbassadorPageMetafield,
    writeAmbassadorPageMetafield,
} from "./metafields";
import { arePageScopesGranted } from "./pageScopes";
import { getThemeBlockPresence } from "./theme";

vi.mock("./theme", async (importActual) => ({
    ...(await importActual<typeof import("./theme")>()),
    getThemeBlockPresence: vi.fn(),
}));
vi.mock("./pageScopes", () => ({ arePageScopesGranted: vi.fn() }));
vi.mock("./metafields", () => ({
    getAmbassadorPageMetafield: vi.fn(),
    writeAmbassadorPageMetafield: vi.fn(),
}));
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
        respond({
            page: {
                handle: "renamed-page",
                isPublished: true,
                templateSuffix: "ambassador",
                body: "<p>hello</p>",
            },
        });

        const url = await resolveAmbassadorPageUrl(
            mockContext,
            "gid://shopify/Page/1"
        );

        expect(url).toEqual({
            ok: true,
            url: "https://www.shop.com/pages/renamed-page",
            templateSuffix: "ambassador",
            body: "<p>hello</p>",
        });
        expect(mockGraphql.mock.calls[0][1]).toEqual({
            variables: { id: "gid://shopify/Page/1" },
        });
        expect(mockGraphql.mock.calls[0][0]).toContain("templateSuffix");
        expect(mockGraphql.mock.calls[0][0]).toContain("body");
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

describe("reconcileAmbassadorPage", () => {
    const pageId = "gid://shopify/Page/1";
    const oldUrl = "https://www.shop.com/pages/old-handle";
    const newUrl = "https://www.shop.com/pages/renamed-page";

    function givenScopes(granted: boolean) {
        vi.mocked(arePageScopesGranted).mockResolvedValue(granted);
    }

    function givenRecord(url: string | null, standardLayoutKept?: boolean) {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url,
            ...(standardLayoutKept === undefined ? {} : { standardLayoutKept }),
        });
    }

    const tag = "<frak-ambassador></frak-ambassador>";

    function givenPage(
        page: Partial<{
            handle: string;
            templateSuffix: string | null;
            body: string;
        }> = {}
    ) {
        respond({
            page: {
                handle: "old-handle",
                isPublished: true,
                templateSuffix: null,
                body: tag,
                ...page,
            },
        });
    }

    beforeEach(() => {
        vi.mocked(arePageScopesGranted).mockReset();
        vi.mocked(getAmbassadorPageMetafield).mockReset();
        vi.mocked(writeAmbassadorPageMetafield).mockReset();
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
    });

    it("reports block-unlinked without any page call when scopes are missing", async () => {
        givenScopes(false);

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "blockUnlinked" });
        expect(mockGraphql).not.toHaveBeenCalled();
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("reports no page when scopes are missing and no block template exists", async () => {
        givenScopes(false);

        await expect(reconcileAmbassadorPage(mockContext, [])).resolves.toEqual(
            { state: "none" }
        );
    });

    it("reports the recorded URL as linked when scopes are missing", async () => {
        givenScopes(false);
        givenRecord(oldUrl);

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "linked", url: oldUrl });
        expect(mockGraphql).not.toHaveBeenCalled();
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("offers to link, without adopting, a published page on a block template", async () => {
        givenScopes(true);
        respond({
            pages: {
                nodes: [
                    {
                        id: pageId,
                        handle: "referral",
                        isPublished: true,
                        templateSuffix: "ambassador",
                        body: "",
                    },
                ],
            },
        });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "blockUnlinked" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("offers only creation when no published page uses the block template", async () => {
        givenScopes(true);
        respond({ pages: { nodes: [] } });

        await expect(
            reconcileAmbassadorPage(mockContext, ["ambassador"])
        ).resolves.toEqual({ state: "none" });
    });

    it("reports no page when scopes are granted, nothing is recorded and no block template exists", async () => {
        givenScopes(true);

        await expect(reconcileAmbassadorPage(mockContext, [])).resolves.toEqual(
            { state: "none" }
        );
    });

    it("writes the record once with the new URL when the page was renamed", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ handle: "renamed-page" });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({
            state: "upgrade",
            url: newUrl,
            template: null,
            standardLayoutKept: false,
            onTemplate: false,
        });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: newUrl,
        });
    });

    it("writes the URL of a page recorded without one", async () => {
        givenScopes(true);
        givenRecord(null);
        givenPage({ handle: "renamed-page", templateSuffix: "ambassador" });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({
            state: "upgrade",
            url: newUrl,
            template: "ambassador",
            standardLayoutKept: false,
            onTemplate: true,
        });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: newUrl,
        });
    });

    it("writes a null URL and reports no page when the page was deleted and no block template exists", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        respond({ page: null });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "none" });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: null,
        });
    });

    it("writes a null URL and offers only creation when the page was unpublished and no published page uses the block template", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        respond({ page: { handle: "old-handle", isPublished: false } });
        respond({ pages: { nodes: [] } });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "none" });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: null,
        });
    });

    it("writes nothing when the derived URL matches the record", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ templateSuffix: "ambassador", body: "" });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "linked", url: oldUrl });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("keeps the recorded URL as linked and writes nothing when the page read fails", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        mockGraphql.mockRejectedValueOnce(new Error("network"));

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "linked", url: oldUrl });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("keeps the recorded URL as linked and writes nothing when the page response has no data", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        mockGraphql.mockResolvedValueOnce({ json: async () => ({}) });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "linked", url: oldUrl });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("falls back to the block suffixes when the page read fails and no URL was recorded", async () => {
        givenScopes(true);
        givenRecord(null);
        mockGraphql.mockRejectedValueOnce(new Error("network"));

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "blockUnlinked" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("falls back to the unlinked state when the record read throws", async () => {
        givenScopes(true);
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("network")
        );

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "blockUnlinked" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("returns the unlinked state instead of throwing when the record write throws", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ handle: "renamed-page" });
        vi.mocked(writeAmbassadorPageMetafield).mockRejectedValue(
            new Error("network")
        );

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "none" });
    });

    it("offers the ambassador template for a page on the default template still holding the tag", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage();

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({
            state: "upgrade",
            url: oldUrl,
            template: "ambassador",
            standardLayoutKept: false,
            onTemplate: false,
        });
    });

    it("reports upgrade with the stored choice when the standard layout was kept", async () => {
        givenScopes(true);
        givenRecord(oldUrl, true);
        givenPage();

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({
            state: "upgrade",
            url: oldUrl,
            template: "ambassador",
            standardLayoutKept: true,
            onTemplate: false,
        });
    });

    it("flags a page on its own template that still holds the tag, ignoring a dismissal", async () => {
        givenScopes(true);
        givenRecord(oldUrl, true);
        givenPage({ templateSuffix: "zeta" });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
            "zeta",
        ]);

        expect(state).toEqual({
            state: "upgrade",
            url: oldUrl,
            template: "zeta",
            standardLayoutKept: false,
            onTemplate: true,
        });
    });

    it("reports blank for an empty body on the default template, even when the standard layout was kept", async () => {
        givenScopes(true);
        givenRecord(oldUrl, true);
        givenPage({ body: "" });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "blank", url: oldUrl, template: null });
    });

    it("reports blank with the picked template when a template is available", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ body: "" });

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({
            state: "blank",
            url: oldUrl,
            template: "ambassador",
        });
    });

    it("reports blank for merchant text without the tag on the default template", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ body: "<p>Join us</p>" });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "blank", url: oldUrl, template: null });
    });

    it("reports blank when the page's template is no longer an ambassador template", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage({ templateSuffix: "deleted", body: "" });

        const state = await reconcileAmbassadorPage(mockContext, []);

        expect(state).toEqual({ state: "blank", url: oldUrl, template: null });
    });

    it("names a template that holds the block whatever its name", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage();

        const state = await reconcileAmbassadorPage(mockContext, ["referral"]);

        expect(state).toMatchObject({ state: "upgrade", template: "referral" });
    });

    it("names the same single template whatever the order of several", async () => {
        givenScopes(true);
        givenRecord(oldUrl);
        givenPage();
        givenPage();

        const first = await reconcileAmbassadorPage(mockContext, [
            "zeta",
            "referral",
        ]);
        const second = await reconcileAmbassadorPage(mockContext, [
            "referral",
            "zeta",
        ]);

        expect(first).toMatchObject({ template: "referral" });
        expect(second).toEqual(first);
    });

    it("keeps the stored choice when a renamed page is rewritten", async () => {
        givenScopes(true);
        givenRecord(oldUrl, true);
        givenPage({ handle: "renamed-page" });

        await reconcileAmbassadorPage(mockContext, []);

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: newUrl,
            standardLayoutKept: true,
        });
    });

    it("keeps the stored choice when the page was unpublished", async () => {
        givenScopes(true);
        givenRecord(oldUrl, true);
        respond({ page: { handle: "old-handle", isPublished: false } });

        await reconcileAmbassadorPage(mockContext, []);

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: null,
            standardLayoutKept: true,
        });
    });

    it("makes no page call and reports linked from the record when scopes are missing, whatever the templates", async () => {
        givenScopes(false);
        givenRecord(oldUrl, true);

        const state = await reconcileAmbassadorPage(mockContext, [
            "ambassador",
        ]);

        expect(state).toEqual({ state: "linked", url: oldUrl });
        expect(mockGraphql).not.toHaveBeenCalled();
    });
});

describe("createAndRecordAmbassadorPage", () => {
    const pageId = "gid://shopify/Page/9";
    const pageUrl = "https://www.shop.com/pages/become-an-ambassador";
    const tag = "<frak-ambassador></frak-ambassador>";

    function listed(
        id: string,
        handle: string,
        body: string,
        templateSuffix: string | null = null
    ) {
        return { id, handle, isPublished: true, templateSuffix, body };
    }

    function givenAmbassadorTemplates(ambassador: string[]) {
        vi.mocked(getThemeBlockPresence).mockResolvedValue({
            banner: false,
            ambassador,
            pageTemplates: ambassador,
        });
    }

    function givenListedPages(nodes: ReturnType<typeof listed>[]) {
        respond({ pages: { nodes } });
    }

    beforeEach(() => {
        vi.mocked(getAmbassadorPageMetafield).mockReset();
        vi.mocked(writeAmbassadorPageMetafield).mockReset();
        vi.mocked(getThemeBlockPresence).mockReset();
        givenAmbassadorTemplates([]);
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
    });

    it("creates the page and writes the record once with its URL", async () => {
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql.mock.calls[1][1].variables.page.title).toBe(
            "Become an ambassador"
        );
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("titles the page in French when the language is fr", async () => {
        givenListedPages([]);
        created(pageId, "devenir-ambassadeur");

        await createAndRecordAmbassadorPage(mockContext, "fr");

        expect(mockGraphql.mock.calls[1][1].variables.page.title).toBe(
            "Devenir ambassadeur"
        );
    });

    it("returns the recorded live page without creating another", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url: pageUrl,
        });
        respond({
            page: { handle: "become-an-ambassador", isPublished: true },
        });

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(mockGraphql.mock.calls[0][1]).toEqual({
            variables: { id: pageId },
        });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("creates a new page when the recorded page was deleted", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId: "gid://shopify/Page/1",
            url: pageUrl,
        });
        respond({ page: null });
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("drops the standard layout choice when it recreates a deleted page", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId: "gid://shopify/Page/1",
            url: pageUrl,
            standardLayoutKept: true,
        });
        respond({ page: null });
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        await createAndRecordAmbassadorPage(mockContext, "en");

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("keeps the standard layout choice when it re-adopts the recorded page", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url: null,
            standardLayoutKept: true,
        });
        respond({
            page: { handle: "become-an-ambassador", isPublished: false },
        });
        givenListedPages([listed(pageId, "become-an-ambassador", tag)]);

        await createAndRecordAmbassadorPage(mockContext, "en");

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
            standardLayoutKept: true,
        });
    });

    it("fails and writes nothing when the record cannot be read", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("boom")
        );

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: false, reason: "createFailed" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("fails without creating when the recorded page cannot be read", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url: pageUrl,
        });
        mockGraphql.mockRejectedValueOnce(new Error("network"));

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: false, reason: "createFailed" });
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("fails with nothing recorded when the page cannot be created", async () => {
        givenListedPages([]);
        respond({
            pageCreate: {
                page: null,
                userErrors: [{ code: "BLANK", message: "no" }],
            },
        });

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: false, reason: "createFailed" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("adopts a published page whose body is exactly the tag instead of creating one", async () => {
        givenListedPages([
            listed("gid://shopify/Page/4", "other", "<p>About us</p>"),
            listed(pageId, "become-an-ambassador", `  ${tag}\n`),
        ]);

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("creates a new page when the only tagged page has other content", async () => {
        givenListedPages([
            listed("gid://shopify/Page/4", "custom", `<p>Hi</p>${tag}`),
        ]);
        created(pageId, "become-an-ambassador");

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("still returns the new page URL when the record write rejects", async () => {
        givenListedPages([]);
        created(pageId, "become-an-ambassador");
        vi.mocked(writeAmbassadorPageMetafield).mockRejectedValue(
            new Error("network")
        );

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
    });

    it("still returns the new page URL when the record write is rejected", async () => {
        givenListedPages([]);
        created(pageId, "become-an-ambassador");
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: false,
            userErrors: [{ field: "value", message: "invalid" }],
        });

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
    });

    it("fails instead of throwing when the record read throws", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("boom")
        );

        await expect(
            createAndRecordAmbassadorPage(mockContext, "en")
        ).resolves.toEqual({ ok: false, reason: "createFailed" });
    });

    it("creates on the ambassador template with an empty body when one exists", async () => {
        givenAmbassadorTemplates(["ambassador"]);
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql.mock.calls[1][1].variables.page).toEqual({
            title: "Become an ambassador",
            handle: "become-an-ambassador",
            body: "",
            templateSuffix: "ambassador",
            isPublished: true,
        });
    });

    it("creates on the picked template when several exist", async () => {
        givenAmbassadorTemplates(["referral", "ambassador"]);
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        await createAndRecordAmbassadorPage(mockContext, "en");

        expect(mockGraphql.mock.calls[1][1].variables.page.templateSuffix).toBe(
            "ambassador"
        );
    });

    it("sends the tag body and no suffix when no ambassador template exists", async () => {
        givenListedPages([]);
        created(pageId, "become-an-ambassador");

        await createAndRecordAmbassadorPage(mockContext, "en");

        const page = mockGraphql.mock.calls[1][1].variables.page;
        expect(page.body).toBe(tag);
        expect(page).not.toHaveProperty("templateSuffix");
    });

    it("adopts a published page on an ambassador template instead of creating one", async () => {
        givenAmbassadorTemplates(["ambassador"]);
        givenListedPages([
            listed(pageId, "become-an-ambassador", "", "ambassador"),
        ]);

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("adopts a page with a retried handle on an ambassador template", async () => {
        givenAmbassadorTemplates(["ambassador"]);
        givenListedPages([
            listed(pageId, "devenir-ambassadeur-3", "", "ambassador"),
        ]);

        await createAndRecordAmbassadorPage(mockContext, "fr");

        expect(mockGraphql).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: "https://www.shop.com/pages/devenir-ambassadeur-3",
        });
    });

    it("creates instead of adopting a merchant's own page on an ambassador template", async () => {
        givenAmbassadorTemplates(["ambassador"]);
        givenListedPages([
            listed("gid://shopify/Page/4", "about", "<p>Hi</p>", "ambassador"),
        ]);
        created(pageId, "become-an-ambassador");

        await createAndRecordAmbassadorPage(mockContext, "en");

        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("adopts the most recently updated of the matching pages", async () => {
        givenAmbassadorTemplates(["ambassador"]);
        givenListedPages([
            listed("gid://shopify/Page/4", "other", "<p>Hi</p>"),
            listed(pageId, "become-an-ambassador", tag),
            listed("gid://shopify/Page/3", "old", "", "ambassador"),
        ]);

        await createAndRecordAmbassadorPage(mockContext, "en");

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("fails without creating when the theme cannot be read", async () => {
        vi.mocked(getThemeBlockPresence).mockRejectedValue(new Error("boom"));

        const result = await createAndRecordAmbassadorPage(mockContext, "en");

        expect(result).toEqual({ ok: false, reason: "createFailed" });
        expect(mockGraphql).not.toHaveBeenCalled();
    });
});

describe("linkAmbassadorPage", () => {
    const pageId = "gid://shopify/Page/5";
    const pageUrl = "https://www.shop.com/pages/join-us";

    function givenPublishedPage() {
        respond({
            pages: {
                nodes: [
                    {
                        id: pageId,
                        handle: "join-us",
                        isPublished: true,
                        templateSuffix: "ambassador",
                    },
                ],
            },
        });
    }

    beforeEach(() => {
        vi.mocked(getThemeBlockPresence).mockReset();
        vi.mocked(writeAmbassadorPageMetafield).mockReset();
        vi.mocked(getAmbassadorPageMetafield).mockReset();
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);
        vi.mocked(getThemeBlockPresence).mockResolvedValue({
            banner: false,
            ambassador: ["ambassador"],
            pageTemplates: ["ambassador"],
        });
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
    });

    it("adopts the published page using the block template and writes the record once", async () => {
        givenPublishedPage();

        const result = await linkAmbassadorPage(mockContext);

        expect(result).toEqual({ ok: true, url: pageUrl });
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("keeps the standard layout choice when it relinks the same page", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url: null,
            standardLayoutKept: true,
        });
        givenPublishedPage();

        await linkAmbassadorPage(mockContext);

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
            standardLayoutKept: true,
        });
    });

    it("drops the standard layout choice when it links a different page", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId: "gid://shopify/Page/1",
            url: null,
            standardLayoutKept: true,
        });
        givenPublishedPage();

        await linkAmbassadorPage(mockContext);

        expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(mockContext, {
            pageId,
            url: pageUrl,
        });
    });

    it("fails and writes nothing when the record cannot be read", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("boom")
        );
        givenPublishedPage();

        const result = await linkAmbassadorPage(mockContext);

        expect(result).toEqual({ ok: false, reason: "linkFailed" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("reports noPublishedPage and writes nothing when no published page uses the template", async () => {
        respond({ pages: { nodes: [] } });

        const result = await linkAmbassadorPage(mockContext);

        expect(result).toEqual({ ok: false, reason: "noPublishedPage" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("fails instead of throwing when the theme read throws", async () => {
        vi.mocked(getThemeBlockPresence).mockRejectedValue(new Error("boom"));

        await expect(linkAmbassadorPage(mockContext)).resolves.toEqual({
            ok: false,
            reason: "linkFailed",
        });
    });
});

describe("page template actions", () => {
    const pageId = "gid://shopify/Page/9";
    const pageUrl = "https://www.shop.com/pages/become-an-ambassador";
    const tag = "<frak-ambassador></frak-ambassador>";

    function givenPage(templateSuffix: string | null, body: string) {
        respond({
            page: {
                handle: "become-an-ambassador",
                isPublished: true,
                templateSuffix,
                body,
            },
        });
    }

    function updated() {
        respond({
            pageUpdate: { page: { id: pageId }, userErrors: [] },
        });
    }

    function sentUpdate() {
        const call = mockGraphql.mock.calls.find(([query]) =>
            String(query).includes("pageUpdate")
        );
        return call?.[1];
    }

    beforeEach(() => {
        vi.mocked(getAmbassadorPageMetafield).mockReset();
        vi.mocked(writeAmbassadorPageMetafield).mockReset();
        vi.mocked(getThemeBlockPresence).mockReset();
        vi.mocked(getAmbassadorPageMetafield).mockResolvedValue({
            pageId,
            url: pageUrl,
        });
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: true,
            userErrors: [],
        });
        vi.mocked(getThemeBlockPresence).mockResolvedValue({
            banner: false,
            ambassador: ["ambassador"],
            pageTemplates: ["ambassador"],
        });
    });

    describe("applyAmbassadorTemplate", () => {
        it("sends the template and an empty body in one pageUpdate", async () => {
            givenPage(null, tag);
            updated();

            const result = await applyAmbassadorTemplate(
                mockContext,
                "ambassador"
            );

            expect(result).toEqual({ ok: true, url: pageUrl });
            expect(sentUpdate()).toEqual({
                variables: {
                    id: pageId,
                    page: { templateSuffix: "ambassador", body: "" },
                },
            });
            expect(
                mockGraphql.mock.calls.filter(([query]) =>
                    String(query).includes("pageUpdate")
                )
            ).toHaveLength(1);
        });

        it("keeps merchant text and removes only the tag", async () => {
            givenPage(null, `<p>Join us</p>${tag}<p>Bye</p>`);
            updated();

            await applyAmbassadorTemplate(mockContext, "ambassador");

            expect(sentUpdate()?.variables.page.body).toBe(
                "<p>Join us</p><p>Bye</p>"
            );
        });

        it.each([
            "<frak-ambassador />",
            "<frak-ambassador>",
            '<frak-ambassador data-x="1"></frak-ambassador >',
        ])("removes the tag written as %s", async (written) => {
            givenPage(null, `<p>a</p>${written}`);
            updated();

            await applyAmbassadorTemplate(mockContext, "ambassador");

            expect(sentUpdate()?.variables.page.body).toBe("<p>a</p>");
        });

        it("applies any ambassador template it is asked for", async () => {
            vi.mocked(getThemeBlockPresence).mockResolvedValue({
                banner: false,
                ambassador: ["referral"],
                pageTemplates: ["referral"],
            });
            givenPage(null, tag);
            updated();

            await applyAmbassadorTemplate(mockContext, "referral");

            expect(sentUpdate()?.variables.page.templateSuffix).toBe(
                "referral"
            );
        });

        it("returns templateMissing and sends nothing when the template no longer holds the block", async () => {
            vi.mocked(getThemeBlockPresence).mockResolvedValue({
                banner: false,
                ambassador: [],
                pageTemplates: ["ambassador"],
            });

            const result = await applyAmbassadorTemplate(
                mockContext,
                "ambassador"
            );

            expect(result).toEqual({ ok: false, reason: "templateMissing" });
            expect(mockGraphql).not.toHaveBeenCalled();
        });

        it("fails and sends no mutation when no page is recorded", async () => {
            vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);

            const result = await applyAmbassadorTemplate(
                mockContext,
                "ambassador"
            );

            expect(result).toEqual({ ok: false, reason: "applyFailed" });
            expect(mockGraphql).not.toHaveBeenCalled();
        });

        it("fails and sends no mutation when the page is unpublished", async () => {
            respond({
                page: {
                    handle: "x",
                    isPublished: false,
                    templateSuffix: null,
                    body: tag,
                },
            });

            const result = await applyAmbassadorTemplate(
                mockContext,
                "ambassador"
            );

            expect(result).toEqual({ ok: false, reason: "applyFailed" });
            expect(sentUpdate()).toBeUndefined();
        });

        it("returns applyFailed on userErrors", async () => {
            givenPage(null, tag);
            respond({
                pageUpdate: {
                    page: null,
                    userErrors: [{ field: ["page"], message: "no" }],
                },
            });

            const result = await applyAmbassadorTemplate(
                mockContext,
                "ambassador"
            );

            expect(result).toEqual({ ok: false, reason: "applyFailed" });
        });

        it("returns applyFailed instead of throwing when the request throws", async () => {
            givenPage(null, tag);
            mockGraphql.mockRejectedValueOnce(new Error("network"));

            await expect(
                applyAmbassadorTemplate(mockContext, "ambassador")
            ).resolves.toEqual({ ok: false, reason: "applyFailed" });
        });
    });

    describe("restoreAmbassadorComponent", () => {
        it("sends the tag alone and an empty template suffix for an empty body", async () => {
            givenPage("ambassador", "");
            updated();

            const result = await restoreAmbassadorComponent(mockContext);

            expect(result).toEqual({ ok: true, url: pageUrl });
            expect(sentUpdate()).toEqual({
                variables: {
                    id: pageId,
                    page: { templateSuffix: "", body: tag },
                },
            });
        });

        it("appends the tag after merchant text", async () => {
            givenPage(null, "<p>Join us</p>");
            updated();

            await restoreAmbassadorComponent(mockContext);

            expect(sentUpdate()?.variables.page.body).toBe(
                `<p>Join us</p>${tag}`
            );
        });

        it("does not add a second tag when the body already holds one", async () => {
            givenPage("ambassador", tag);
            updated();

            await restoreAmbassadorComponent(mockContext);

            expect(sentUpdate()?.variables.page.body).toBe(tag);
        });

        it("fails and sends no mutation when no page is recorded", async () => {
            vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);

            const result = await restoreAmbassadorComponent(mockContext);

            expect(result).toEqual({ ok: false, reason: "restoreFailed" });
            expect(mockGraphql).not.toHaveBeenCalled();
        });

        it("returns restoreFailed on userErrors", async () => {
            givenPage(null, "");
            respond({
                pageUpdate: {
                    page: null,
                    userErrors: [{ field: ["page"], message: "no" }],
                },
            });

            const result = await restoreAmbassadorComponent(mockContext);

            expect(result).toEqual({ ok: false, reason: "restoreFailed" });
        });
    });

    describe("keepStandardLayout", () => {
        it("writes the choice and keeps the page id and URL", async () => {
            const result = await keepStandardLayout(mockContext);

            expect(result).toEqual({ ok: true, url: pageUrl });
            expect(writeAmbassadorPageMetafield).toHaveBeenCalledOnce();
            expect(writeAmbassadorPageMetafield).toHaveBeenCalledWith(
                mockContext,
                { pageId, url: pageUrl, standardLayoutKept: true }
            );
            expect(mockGraphql).not.toHaveBeenCalled();
        });

        it("fails and writes nothing when no page is recorded", async () => {
            vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(null);

            const result = await keepStandardLayout(mockContext);

            expect(result).toEqual({ ok: false, reason: "keepFailed" });
            expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
        });

        it("fails when the write is rejected", async () => {
            vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
                success: false,
                userErrors: [{ field: "value", message: "invalid" }],
            });

            const result = await keepStandardLayout(mockContext);

            expect(result).toEqual({ ok: false, reason: "keepFailed" });
        });

        it("fails instead of throwing when the write throws", async () => {
            vi.mocked(writeAmbassadorPageMetafield).mockRejectedValue(
                new Error("network")
            );

            await expect(keepStandardLayout(mockContext)).resolves.toEqual({
                ok: false,
                reason: "keepFailed",
            });
        });
    });
});

describe("normalizeAmbassadorPageLanguage", () => {
    it.each([
        ["fr", "fr"],
        ["fr-FR", "fr"],
        ["fr_CA", "fr"],
        ["en", "en"],
        ["de", "en"],
        ["", "en"],
        [null, "en"],
    ])("maps %s to %s", (input, expected) => {
        expect(normalizeAmbassadorPageLanguage(input)).toBe(expected);
    });
});
