import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AMBASSADOR_LIQUID from "../../proxy/ambassador.liquid?raw";
import type { AuthenticatedContext } from "../types/context";
import {
    addAmbassadorMenuLink,
    getAmbassadorPageOverview,
    getAmbassadorPageStatus,
    hideAmbassadorPage,
    parseAmbassadorRecord,
    probeAmbassadorPage,
    publishAmbassadorPage,
    switchToFullWidthPage,
} from "./ambassadorPage";
import {
    getAmbassadorPageMetafield,
    writeAmbassadorPageMetafield,
} from "./metafields";
import {
    addMenuLink,
    presentMenuLinks,
    removeMenuLinks,
    repointPageLinks,
} from "./navigation";
import { grantedOptionalScopes } from "./optionalScopes";

vi.mock("./logger", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("./metafields", () => ({
    getAmbassadorPageMetafield: vi.fn(),
    writeAmbassadorPageMetafield: vi.fn(),
}));
vi.mock("./navigation", () => ({
    addMenuLink: vi.fn(),
    presentMenuLinks: vi.fn(),
    removeMenuLinks: vi.fn(),
    repointPageLinks: vi.fn(),
}));
vi.mock("./optionalScopes", () => ({ grantedOptionalScopes: vi.fn() }));
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

const LINK = {
    menuId: "gid://shopify/Menu/1",
    itemId: "gid://shopify/MenuItem/9",
};
const FOOTER_LINK = {
    menuId: "gid://shopify/Menu/2",
    itemId: "gid://shopify/MenuItem/4",
};
const ALL_SCOPES = { proxy: true, menu: true, pages: true };
const V1 = {
    pageId: "gid://shopify/Page/7",
    url: "https://www.shop.com/pages/become-an-ambassador",
};

function stored(raw: unknown) {
    vi.mocked(getAmbassadorPageMetafield).mockResolvedValue(
        raw as Awaited<ReturnType<typeof getAmbassadorPageMetafield>>
    );
}

function granted(scopes: Partial<typeof ALL_SCOPES>) {
    vi.mocked(grantedOptionalScopes).mockResolvedValue({
        proxy: false,
        menu: false,
        pages: false,
        ...scopes,
    });
}

function respond(data: unknown) {
    mockGraphql.mockResolvedValueOnce({ json: async () => ({ data }) });
}

function writes() {
    return vi
        .mocked(writeAmbassadorPageMetafield)
        .mock.calls.map(([, record]) => record);
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGraphql.mockReset();
    vi.stubEnv("STAGE", "production");
    vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
        success: true,
        userErrors: [],
    });
    granted(ALL_SCOPES);
    stored(null);
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("parseAmbassadorRecord", () => {
    it("reads no record from null, a string or an unknown shape", () => {
        expect(parseAmbassadorRecord(null)).toEqual({ kind: "none" });
        expect(parseAmbassadorRecord("page")).toEqual({ kind: "none" });
        expect(parseAmbassadorRecord({ v: 3 })).toEqual({ kind: "none" });
    });

    it("reads a pageId record as the old page", () => {
        expect(
            parseAmbassadorRecord({ ...V1, standardLayoutKept: true })
        ).toEqual({
            kind: "oldPage",
            pageId: V1.pageId,
            url: V1.url,
        });
        expect(parseAmbassadorRecord({ pageId: V1.pageId, url: 42 })).toEqual({
            kind: "oldPage",
            pageId: V1.pageId,
            url: null,
        });
    });

    it("reads a v2 record and keeps only well-formed fields", () => {
        expect(
            parseAmbassadorRecord({
                v: 2,
                published: "yes",
                publishedAt: "2026-10-01T00:00:00.000Z",
                menuLinks: [{ menuId: "m" }, LINK],
                legacy: {
                    pageId: "p",
                    handle: "h",
                    switchedAt: "s",
                    redirectId: "r",
                },
            })
        ).toEqual({
            kind: "proxy",
            record: {
                v: 2,
                published: false,
                publishedAt: "2026-10-01T00:00:00.000Z",
                menuLinks: [LINK],
                legacy: {
                    pageId: "p",
                    handle: "h",
                    switchedAt: "s",
                    redirectId: "r",
                },
            },
        });
    });

    it("keeps a legacy page whose handle is unknown", () => {
        expect(
            parseAmbassadorRecord({
                v: 2,
                published: true,
                menuLinks: "nope",
                legacy: { pageId: "p", switchedAt: "s" },
            })
        ).toEqual({
            kind: "proxy",
            record: {
                v: 2,
                published: true,
                legacy: { pageId: "p", switchedAt: "s" },
            },
        });
    });
});

describe("getAmbassadorPageStatus", () => {
    it.each([
        ["draft", null],
        ["draft", { v: 2, published: false }],
        ["hidden", { v: 2, published: false, publishedAt: "2026-10-01" }],
        ["live", { v: 2, published: true, publishedAt: "2026-10-01" }],
        ["oldPage", V1],
    ])("is %s for %j", async (status, raw) => {
        stored(raw);
        expect(await getAmbassadorPageStatus(mockContext)).toBe(status);
    });

    it("is undefined when the metafield cannot be read", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("boom")
        );
        expect(await getAmbassadorPageStatus(mockContext)).toBeUndefined();
    });
});

describe("getAmbassadorPageOverview", () => {
    it("builds the URL from the primary domain and the stage path", async () => {
        stored({ v: 2, published: true, publishedAt: "2026-10-01" });
        expect(await getAmbassadorPageOverview(mockContext)).toEqual({
            status: "live",
            url: "https://www.shop.com/apps/ambassador",
            path: "/apps/ambassador",
            oldPageUrl: null,
            menu: { state: "none" },
            scopes: ALL_SCOPES,
        });
        expect(presentMenuLinks).not.toHaveBeenCalled();
    });

    it.each([
        [[LINK], "added"],
        [[FOOTER_LINK], "added"],
        [[], "missing"],
        [null, "none"],
    ] as const)(
        "reports the recorded links with %j present as %s",
        async (present, state) => {
            stored({ v: 2, published: true, menuLinks: [LINK, FOOTER_LINK] });
            vi.mocked(presentMenuLinks).mockResolvedValue(
                present === null ? null : [...present]
            );
            const overview = await getAmbassadorPageOverview(mockContext);
            expect(overview?.menu.state).toBe(state);
            expect(presentMenuLinks).toHaveBeenCalledWith(mockContext, [
                LINK,
                FOOTER_LINK,
            ]);
        }
    );

    it("does not check the menu without the navigation scope", async () => {
        stored({ v: 2, published: true, menuLinks: [LINK] });
        granted({ proxy: true });
        const overview = await getAmbassadorPageOverview(mockContext);
        expect(overview?.menu.state).toBe("none");
        expect(presentMenuLinks).not.toHaveBeenCalled();
    });

    it("shows nothing granted when the scopes cannot be read", async () => {
        stored({ v: 2, published: true, menuLinks: [LINK] });
        vi.mocked(grantedOptionalScopes).mockResolvedValue(null);
        const overview = await getAmbassadorPageOverview(mockContext);
        expect(overview).toMatchObject({
            status: "live",
            menu: { state: "none" },
            scopes: { proxy: false, menu: false, pages: false },
        });
    });

    it("gives the old page URL of a v1 record", async () => {
        stored(V1);
        const overview = await getAmbassadorPageOverview(mockContext);
        expect(overview).toMatchObject({
            status: "oldPage",
            oldPageUrl: V1.url,
        });
    });

    it("is null when the record cannot be read", async () => {
        vi.mocked(getAmbassadorPageMetafield).mockRejectedValue(
            new Error("boom")
        );
        expect(await getAmbassadorPageOverview(mockContext)).toBeNull();
    });
});

describe("publishAmbassadorPage", () => {
    it("fails, writing nothing, when the scopes cannot be read", async () => {
        vi.mocked(grantedOptionalScopes).mockResolvedValue(null);
        expect(
            await publishAmbassadorPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "publish", error: "failed" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("fails with scopeMissing and writes nothing without the proxy scope", async () => {
        granted({ menu: true });
        expect(
            await publishAmbassadorPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "publish", error: "scopeMissing" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("writes the published record before adding the menu link, then records the link", async () => {
        vi.mocked(addMenuLink).mockImplementation(async () => {
            expect(writes()).toHaveLength(1);
            return LINK;
        });

        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "fr",
        });

        expect(result).toEqual({
            ok: true,
            intent: "publish",
            url: "https://www.shop.com/apps/ambassador",
            menu: "added",
        });
        expect(addMenuLink).toHaveBeenCalledWith(mockContext, {
            title: "Devenir ambassadeur",
            url: "/apps/ambassador",
        });
        const [first, second] = writes();
        expect(first).toEqual({
            v: 2,
            published: true,
            publishedAt: expect.any(String),
        });
        expect(second).toEqual({ ...first, menuLinks: [LINK] });
    });

    it("keeps the first publishedAt when publishing again", async () => {
        stored({ v: 2, published: false, publishedAt: "2026-09-01" });
        await publishAmbassadorPage(mockContext, {
            addToMenu: false,
            language: "en",
        });
        expect(writes()).toEqual([
            { v: 2, published: true, publishedAt: "2026-09-01" },
        ]);
        expect(addMenuLink).not.toHaveBeenCalled();
    });

    it("does not add a link while a recorded one is still in a menu", async () => {
        stored({
            v: 2,
            published: false,
            publishedAt: "2026-09-01",
            menuLinks: [LINK, FOOTER_LINK],
        });
        vi.mocked(presentMenuLinks).mockResolvedValue([FOOTER_LINK]);
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "added" });
        expect(addMenuLink).not.toHaveBeenCalled();
        expect(writes()).toHaveLength(1);
    });

    it("replaces recorded links that are all gone with the new one", async () => {
        stored({
            v: 2,
            published: false,
            publishedAt: "2026-09-01",
            menuLinks: [FOOTER_LINK],
        });
        vi.mocked(presentMenuLinks).mockResolvedValue([]);
        vi.mocked(addMenuLink).mockResolvedValue(LINK);
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "added" });
        expect(writes()[1]).toEqual({
            v: 2,
            published: true,
            publishedAt: "2026-09-01",
            menuLinks: [LINK],
        });
    });

    it("adds nothing when the recorded links cannot be checked", async () => {
        stored({ v: 2, published: false, menuLinks: [LINK] });
        vi.mocked(presentMenuLinks).mockResolvedValue(null);
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "failed" });
        expect(addMenuLink).not.toHaveBeenCalled();
    });

    it("publishes with menu failed when the link cannot be added", async () => {
        vi.mocked(addMenuLink).mockResolvedValue(null);
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "failed" });
        expect(writes()).toHaveLength(1);
    });

    it("removes a link it could not record", async () => {
        vi.mocked(addMenuLink).mockResolvedValue(LINK);
        vi.mocked(writeAmbassadorPageMetafield)
            .mockResolvedValueOnce({ success: true, userErrors: [] })
            .mockResolvedValueOnce({ success: false, userErrors: [] });
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "failed" });
        expect(removeMenuLinks).toHaveBeenCalledWith(mockContext, [LINK]);
    });

    it("skips the menu without the navigation scope", async () => {
        granted({ proxy: true });
        const result = await publishAmbassadorPage(mockContext, {
            addToMenu: true,
            language: "en",
        });
        expect(result).toMatchObject({ ok: true, menu: "skipped" });
        expect(addMenuLink).not.toHaveBeenCalled();
    });

    it("fails without touching the menu when the record write fails", async () => {
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: false,
            userErrors: [{ field: "value", message: "bad" }],
        });
        expect(
            await publishAmbassadorPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "publish", error: "failed" });
        expect(addMenuLink).not.toHaveBeenCalled();
    });

    it("refuses to overwrite an old page record", async () => {
        stored(V1);
        expect(
            await publishAmbassadorPage(mockContext, {
                addToMenu: false,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "publish", error: "invalid" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });
});

describe("hideAmbassadorPage", () => {
    const LIVE = {
        v: 2,
        published: true,
        publishedAt: "2026-09-01",
        menuLinks: [LINK, FOOTER_LINK],
    };

    it("unpublishes, removes every recorded link and drops them from the record", async () => {
        stored(LIVE);
        vi.mocked(removeMenuLinks).mockResolvedValue([]);
        expect(await hideAmbassadorPage(mockContext)).toEqual({
            ok: true,
            intent: "hide",
        });
        expect(removeMenuLinks).toHaveBeenCalledWith(mockContext, [
            LINK,
            FOOTER_LINK,
        ]);
        expect(writes()).toEqual([
            { v: 2, published: false, publishedAt: "2026-09-01" },
        ]);
    });

    it("keeps the links it could not remove and warns", async () => {
        stored(LIVE);
        vi.mocked(removeMenuLinks).mockResolvedValue([FOOTER_LINK]);
        expect(await hideAmbassadorPage(mockContext)).toEqual({
            ok: true,
            intent: "hide",
            warnings: ["menuRemoveFailed"],
        });
        expect(writes()[0]).toMatchObject({
            published: false,
            menuLinks: [FOOTER_LINK],
        });
    });

    it("keeps the links and warns without the navigation scope", async () => {
        stored(LIVE);
        granted({ proxy: true });
        expect(await hideAmbassadorPage(mockContext)).toMatchObject({
            ok: true,
            warnings: ["menuRemoveFailed"],
        });
        expect(removeMenuLinks).not.toHaveBeenCalled();
        expect(writes()[0]).toMatchObject({ menuLinks: LIVE.menuLinks });
    });

    it("fails, writing nothing, when the scopes cannot be read", async () => {
        stored(LIVE);
        vi.mocked(grantedOptionalScopes).mockResolvedValue(null);
        expect(await hideAmbassadorPage(mockContext)).toEqual({
            ok: false,
            intent: "hide",
            error: "failed",
        });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("is invalid without a proxy page record", async () => {
        stored(null);
        expect(await hideAmbassadorPage(mockContext)).toEqual({
            ok: false,
            intent: "hide",
            error: "invalid",
        });
    });
});

describe("addAmbassadorMenuLink", () => {
    it("fails when the scopes cannot be read", async () => {
        vi.mocked(grantedOptionalScopes).mockResolvedValue(null);
        stored({ v: 2, published: true });
        expect(
            await addAmbassadorMenuLink(mockContext, { language: "en" })
        ).toEqual({ ok: false, intent: "addToMenu", error: "failed" });
    });

    it("fails with scopeMissing without the navigation scope", async () => {
        granted({ proxy: true });
        stored({ v: 2, published: true });
        expect(
            await addAmbassadorMenuLink(mockContext, { language: "en" })
        ).toEqual({ ok: false, intent: "addToMenu", error: "scopeMissing" });
    });

    it("adds the English link and records it", async () => {
        stored({ v: 2, published: true, publishedAt: "2026-09-01" });
        vi.mocked(addMenuLink).mockResolvedValue(LINK);
        expect(
            await addAmbassadorMenuLink(mockContext, { language: "en" })
        ).toEqual({ ok: true, intent: "addToMenu", menu: "added" });
        expect(addMenuLink).toHaveBeenCalledWith(mockContext, {
            title: "Become an ambassador",
            url: "/apps/ambassador",
        });
        expect(writes()).toEqual([
            {
                v: 2,
                published: true,
                publishedAt: "2026-09-01",
                menuLinks: [LINK],
            },
        ]);
    });

    it("fails when the link cannot be added", async () => {
        stored({ v: 2, published: true });
        vi.mocked(addMenuLink).mockResolvedValue(null);
        expect(
            await addAmbassadorMenuLink(mockContext, { language: "en" })
        ).toEqual({ ok: false, intent: "addToMenu", error: "failed" });
    });
});

describe("switchToFullWidthPage", () => {
    const LEGACY_START = {
        pageId: V1.pageId,
        handle: "become-an-ambassador",
        switchedAt: expect.any(String),
    };

    function pageRead(handle: string | null) {
        respond({
            page: handle ? { id: V1.pageId, handle } : null,
        });
    }
    function pageUpdated(ok: boolean) {
        respond({
            pageUpdate: ok
                ? { page: { id: V1.pageId }, userErrors: [] }
                : { page: null, userErrors: [{ message: "nope" }] },
        });
    }
    function redirectCreated(result: "created" | "taken" | "failed") {
        respond({
            urlRedirectCreate:
                result === "created"
                    ? {
                          urlRedirect: { id: "gid://shopify/UrlRedirect/5" },
                          userErrors: [],
                      }
                    : {
                          urlRedirect: null,
                          userErrors: [
                              {
                                  code: "CREATE_FAILED",
                                  message:
                                      result === "taken"
                                          ? "Path has already been taken"
                                          : "Target is invalid",
                              },
                          ],
                      },
        });
    }
    function redirectFound(target: string) {
        respond({
            urlRedirects: {
                nodes: [
                    {
                        id: "gid://shopify/UrlRedirect/8",
                        path: "/pages/become-an-ambassador-old",
                        target: "/elsewhere",
                    },
                    {
                        id: "gid://shopify/UrlRedirect/9",
                        path: "/pages/become-an-ambassador",
                        target,
                    },
                ],
            },
        });
    }
    function sent(name: string) {
        return mockGraphql.mock.calls.find(([query]) =>
            String(query).includes(`${name}(`)
        )?.[1].variables;
    }
    function repointed(changed: (typeof LINK)[], failed = false) {
        vi.mocked(repointPageLinks).mockResolvedValue({ changed, failed });
    }

    beforeEach(() => {
        stored(V1);
        repointed([]);
    });

    it("needs the proxy, navigation and page scopes", async () => {
        granted({ proxy: true, menu: true });
        expect(
            await switchToFullWidthPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "switch", error: "scopeMissing" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
    });

    it("fails, touching nothing, when the scopes cannot be read", async () => {
        vi.mocked(grantedOptionalScopes).mockResolvedValue(null);
        expect(
            await switchToFullWidthPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "switch", error: "failed" });
        expect(writeAmbassadorPageMetafield).not.toHaveBeenCalled();
        expect(repointPageLinks).not.toHaveBeenCalled();
    });

    it("is invalid without an old page record", async () => {
        stored({ v: 2, published: true });
        expect(
            await switchToFullWidthPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "switch", error: "invalid" });
    });

    it("aborts before touching the shop when the first write fails", async () => {
        vi.mocked(writeAmbassadorPageMetafield).mockResolvedValue({
            success: false,
            userErrors: [],
        });
        expect(
            await switchToFullWidthPage(mockContext, {
                addToMenu: true,
                language: "en",
            })
        ).toEqual({ ok: false, intent: "switch", error: "failed" });
        expect(repointPageLinks).not.toHaveBeenCalled();
        expect(mockGraphql).not.toHaveBeenCalled();
    });

    it("records the legacy page in the first write, before touching the shop", async () => {
        vi.mocked(repointPageLinks).mockImplementation(async () => {
            expect(writes()).toEqual([
                {
                    v: 2,
                    published: true,
                    publishedAt: expect.any(String),
                    legacy: LEGACY_START,
                },
            ]);
            return { changed: [], failed: false };
        });
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        await switchToFullWidthPage(mockContext, {
            addToMenu: false,
            language: "en",
        });

        expect(repointPageLinks).toHaveBeenCalledOnce();
        const [first] = writes();
        expect(first.legacy?.switchedAt).toBe(first.publishedAt);
    });

    it("publishes, repoints, retires the old page, redirects it and records the moved links", async () => {
        repointed([LINK, FOOTER_LINK]);
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: true,
            language: "en",
        });

        expect(result).toEqual({
            ok: true,
            intent: "switch",
            url: "https://www.shop.com/apps/ambassador",
            menu: "skipped",
        });
        expect(repointPageLinks).toHaveBeenCalledWith(mockContext, {
            pageId: V1.pageId,
            url: "/apps/ambassador",
        });
        expect(sent("pageUpdate")).toEqual({
            id: V1.pageId,
            page: {
                isPublished: false,
                handle: "become-an-ambassador-previous-7",
                redirectNewHandle: false,
            },
        });
        expect(sent("urlRedirectCreate")).toEqual({
            urlRedirect: {
                path: "/pages/become-an-ambassador",
                target: "/apps/ambassador",
            },
        });
        expect(addMenuLink).not.toHaveBeenCalled();
        const [first, last] = writes();
        expect(last).toEqual({
            ...first,
            menuLinks: [LINK, FOOTER_LINK],
            legacy: {
                ...first.legacy,
                redirectId: "gid://shopify/UrlRedirect/5",
            },
        });
    });

    it("adds the menu link when no link pointed at the old page", async () => {
        vi.mocked(addMenuLink).mockResolvedValue(LINK);
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: true,
            language: "fr",
        });

        expect(result).toMatchObject({ ok: true, menu: "added" });
        expect(result).not.toHaveProperty("warnings");
        expect(addMenuLink).toHaveBeenCalledWith(mockContext, {
            title: "Devenir ambassadeur",
            url: "/apps/ambassador",
        });
        expect(writes()[1]).toMatchObject({ menuLinks: [LINK] });
    });

    it("adds no link when the merchant unticked the box", async () => {
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: false,
            language: "en",
        });

        expect(result).not.toHaveProperty("menu");
        expect(addMenuLink).not.toHaveBeenCalled();
        expect(writes()[1]).not.toHaveProperty("menuLinks");
    });

    it("records the links repointed before a menu failed, warns, and adds none", async () => {
        repointed([FOOTER_LINK], true);
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: true,
            language: "en",
        });

        expect(result).toMatchObject({
            ok: true,
            menu: "skipped",
            warnings: ["repointFailed"],
        });
        expect(addMenuLink).not.toHaveBeenCalled();
        expect(writes()[1]).toMatchObject({ menuLinks: [FOOTER_LINK] });
    });

    it("counts a path already redirected to the proxy page as done", async () => {
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("taken");
        redirectFound("https://www.shop.com/apps/ambassador");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: false,
            language: "en",
        });

        expect(result).not.toHaveProperty("warnings");
        expect(sent("urlRedirects")).toEqual({
            query: 'path:"/pages/become-an-ambassador"',
        });
        expect(writes()[1].legacy).not.toHaveProperty("redirectId");
    });

    it("warns when the path is already redirected somewhere else", async () => {
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("taken");
        redirectFound("/collections/all");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: false,
            language: "en",
        });

        expect(result).toMatchObject({ warnings: ["redirectFailed"] });
    });

    it("turns failed later steps into warnings, with the handle taken from the old URL", async () => {
        repointed([], true);
        vi.mocked(addMenuLink).mockResolvedValue(null);
        pageRead(null);
        redirectCreated("failed");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: true,
            language: "en",
        });

        expect(result).toEqual({
            ok: true,
            intent: "switch",
            url: "https://www.shop.com/apps/ambassador",
            menu: "failed",
            warnings: ["repointFailed", "redirectFailed"],
        });
        expect(sent("pageUpdate")).toBeUndefined();
        expect(sent("urlRedirectCreate")?.urlRedirect.path).toBe(
            "/pages/become-an-ambassador"
        );
    });

    it("warns when the old page cannot be retired", async () => {
        repointed([LINK]);
        pageRead("become-an-ambassador");
        pageUpdated(false);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: false,
            language: "en",
        });

        expect(result).toEqual({
            ok: true,
            intent: "switch",
            url: "https://www.shop.com/apps/ambassador",
            warnings: ["oldPageHideFailed"],
        });
    });

    it("removes the link it added when the last write fails", async () => {
        vi.mocked(addMenuLink).mockResolvedValue(LINK);
        vi.mocked(writeAmbassadorPageMetafield)
            .mockResolvedValueOnce({ success: true, userErrors: [] })
            .mockResolvedValueOnce({ success: false, userErrors: [] });
        pageRead("become-an-ambassador");
        pageUpdated(true);
        redirectCreated("created");

        const result = await switchToFullWidthPage(mockContext, {
            addToMenu: true,
            language: "en",
        });

        expect(result).toMatchObject({
            ok: true,
            menu: "failed",
            warnings: ["recordFailed"],
        });
        expect(removeMenuLinks).toHaveBeenCalledWith(mockContext, [LINK]);
    });
});

describe("probeAmbassadorPage", () => {
    const fetchMock = vi.fn();
    let counter = 0;
    // A fresh URL per probe keeps the 60s cache from leaking between tests.
    const nextUrl = () => {
        counter += 1;
        return `https://probe-${counter}.example/apps/ambassador`;
    };

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("is live when the page renders the marker", async () => {
        fetchMock.mockResolvedValue(
            new Response('<div data-frak-amb-page="shop.myshopify.com">')
        );
        const url = nextUrl();
        expect(await probeAmbassadorPage(url)).toBe("live");
        expect(fetchMock).toHaveBeenCalledWith(url, {
            redirect: "manual",
            signal: expect.any(AbortSignal),
        });
    });

    it("is missing on a 200 without the marker", async () => {
        fetchMock.mockResolvedValue(
            new Response("<div data-frak-amb-missing>")
        );
        expect(await probeAmbassadorPage(nextUrl())).toBe("missing");
    });

    it("is missing on a 404", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 404 }));
        expect(await probeAmbassadorPage(nextUrl())).toBe("missing");
    });

    it("is locked on a redirect to the password page", async () => {
        fetchMock.mockResolvedValue(
            new Response(null, {
                status: 302,
                headers: { location: "https://www.shop.com/password" },
            })
        );
        expect(await probeAmbassadorPage(nextUrl())).toBe("locked");
    });

    it("is locked on a 401", async () => {
        fetchMock.mockResolvedValue(new Response("", { status: 401 }));
        expect(await probeAmbassadorPage(nextUrl())).toBe("locked");
    });

    it("is unknown on any other redirect, a 5xx or a thrown fetch", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(null, {
                status: 301,
                headers: { location: "https://other.com/apps/ambassador" },
            })
        );
        expect(await probeAmbassadorPage(nextUrl())).toBe("unknown");
        fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
        expect(await probeAmbassadorPage(nextUrl())).toBe("unknown");
        fetchMock.mockRejectedValueOnce(new Error("timeout"));
        expect(await probeAmbassadorPage(nextUrl())).toBe("unknown");
    });

    it("caches a live probe per URL", async () => {
        fetchMock.mockImplementation(
            async () => new Response("<div data-frak-amb-page>")
        );
        const url = nextUrl();
        await probeAmbassadorPage(url);
        await probeAmbassadorPage(url);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each([
        ["missing", () => new Response("", { status: 404 })],
        [
            "locked",
            () =>
                new Response(null, {
                    status: 302,
                    headers: { location: "https://www.shop.com/password" },
                }),
        ],
    ] as const)(
        "does not cache a %s probe, so a fix shows at once",
        async (probe, response) => {
            fetchMock.mockResolvedValueOnce(response());
            fetchMock.mockResolvedValueOnce(
                new Response("<div data-frak-amb-page>")
            );
            const url = nextUrl();
            expect(await probeAmbassadorPage(url)).toBe(probe);
            expect(await probeAmbassadorPage(url)).toBe("live");
        }
    );

    it("does not cache an unknown probe", async () => {
        fetchMock.mockRejectedValueOnce(new Error("timeout"));
        fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
        const url = nextUrl();
        expect(await probeAmbassadorPage(url)).toBe("unknown");
        expect(await probeAmbassadorPage(url)).toBe("missing");
    });
});

describe("proxy/ambassador.liquid", () => {
    const MARKER = "data-frak-amb-page";

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const LIQUID_TAG = /\{%-?\s*(\w+)[^%]*%\}/g;

    function depthChange(tag: string): number {
        if (tag === "if" || tag === "unless") return 1;
        return tag === "endif" || tag === "endunless" ? -1 : 0;
    }

    /** Offsets of the `else` and `endif` closing the first top-level `if`. */
    function topLevelBranches(source: string) {
        let depth = 0;
        let elseTag: RegExpMatchArray | undefined;
        for (const tag of source.matchAll(LIQUID_TAG)) {
            if (tag[1] === "else" && depth === 1) elseTag ??= tag;
            depth += depthChange(tag[1]);
            if (depth === 0 && elseTag) {
                const elseAt = elseTag.index ?? 0;
                return {
                    elseAt,
                    elseEnd: elseAt + elseTag[0].length,
                    endifAt: tag.index ?? 0,
                };
            }
        }
        throw new Error("no top-level if/else in the Liquid file");
    }

    it("renders the probe marker exactly once, inside the published branch", () => {
        const occurrences = AMBASSADOR_LIQUID.split(MARKER).length - 1;
        expect(occurrences).toBe(1);
        const publishedAt = AMBASSADOR_LIQUID.indexOf(
            "{%- if frak_amb.v == 2 and frak_amb.published -%}"
        );
        const markerAt = AMBASSADOR_LIQUID.indexOf(MARKER);
        expect(publishedAt).toBeGreaterThanOrEqual(0);
        expect(markerAt).toBeGreaterThan(publishedAt);
        expect(markerAt).toBeLessThan(
            topLevelBranches(AMBASSADOR_LIQUID).elseAt
        );
    });

    it("probes the not-found branch as missing", async () => {
        const { elseEnd, endifAt } = topLevelBranches(AMBASSADOR_LIQUID);
        const notFound = AMBASSADOR_LIQUID.slice(elseEnd, endifAt);
        expect(notFound).toContain("data-frak-amb-missing");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(notFound))
        );
        expect(
            await probeAmbassadorPage("https://liquid.example/apps/ambassador")
        ).toBe("missing");
    });
});
