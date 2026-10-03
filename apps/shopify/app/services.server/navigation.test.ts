import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedContext } from "../types/context";
import {
    addMenuLink,
    findMainMenu,
    type MenuItemNode,
    type MenuNode,
    presentMenuLinks,
    removeMenuLinks,
    repointPageLinks,
} from "./navigation";

vi.mock("./logger", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mockGraphql = vi.fn();
const mockContext = {
    admin: { graphql: mockGraphql },
} as unknown as AuthenticatedContext;

function respond(data: unknown) {
    mockGraphql.mockResolvedValueOnce({ json: async () => ({ data }) });
}

function item(id: string, overrides: Partial<MenuItemNode> = {}): MenuItemNode {
    return {
        id: `gid://shopify/MenuItem/${id}`,
        title: `Item ${id}`,
        type: "COLLECTION",
        url: `/collections/${id}`,
        resourceId: `gid://shopify/Collection/${id}`,
        tags: [],
        items: [],
        ...overrides,
    };
}

function menu(handle: string, items: MenuItemNode[], id = "1"): MenuNode {
    return {
        id: `gid://shopify/Menu/${id}`,
        handle,
        title: handle === "main-menu" ? "Main menu" : "Footer",
        items,
    };
}

function updated(next: MenuNode) {
    respond({ menuUpdate: { menu: next, userErrors: [] } });
}

function sentUpdate() {
    const call = mockGraphql.mock.calls.find(([query]) =>
        String(query).includes("menuUpdate(")
    );
    return call?.[1].variables;
}

const NESTED = item("10", {
    title: "Shop",
    tags: ["summer"],
    items: [
        item("11", {
            items: [item("12", { items: undefined, tags: ["a", "b"] })],
        }),
    ],
});

beforeEach(() => {
    mockGraphql.mockReset();
});

describe("findMainMenu", () => {
    it("returns the menu whose handle is main-menu", async () => {
        respond({
            menus: {
                nodes: [menu("footer", [], "2"), menu("main-menu", [])],
            },
        });
        expect((await findMainMenu(mockContext))?.handle).toBe("main-menu");
    });

    it("returns null when the shop has no main-menu", async () => {
        respond({ menus: { nodes: [menu("footer", [], "2")] } });
        expect(await findMainMenu(mockContext)).toBeNull();
    });

    it("returns null when the menus query throws", async () => {
        mockGraphql.mockRejectedValueOnce(new Error("boom"));
        expect(await findMainMenu(mockContext)).toBeNull();
    });
});

describe("addMenuLink", () => {
    it("resends every untouched item and child with its id, then appends the HTTP link", async () => {
        const main = menu("main-menu", [NESTED, item("20")]);
        respond({ menus: { nodes: [main] } });
        updated({ ...main, items: [...main.items, item("99")] });

        const result = await addMenuLink(mockContext, {
            title: "Become an ambassador",
            url: "/apps/ambassador",
        });

        expect(result).toEqual({
            menuId: "gid://shopify/Menu/1",
            itemId: "gid://shopify/MenuItem/99",
        });
        expect(sentUpdate()).toEqual({
            id: "gid://shopify/Menu/1",
            title: "Main menu",
            handle: "main-menu",
            items: [
                {
                    id: "gid://shopify/MenuItem/10",
                    title: "Shop",
                    type: "COLLECTION",
                    url: "/collections/10",
                    resourceId: "gid://shopify/Collection/10",
                    tags: ["summer"],
                    items: [
                        {
                            id: "gid://shopify/MenuItem/11",
                            title: "Item 11",
                            type: "COLLECTION",
                            url: "/collections/11",
                            resourceId: "gid://shopify/Collection/11",
                            tags: [],
                            items: [
                                {
                                    id: "gid://shopify/MenuItem/12",
                                    title: "Item 12",
                                    type: "COLLECTION",
                                    url: "/collections/12",
                                    resourceId: "gid://shopify/Collection/12",
                                    tags: ["a", "b"],
                                },
                            ],
                        },
                    ],
                },
                {
                    id: "gid://shopify/MenuItem/20",
                    title: "Item 20",
                    type: "COLLECTION",
                    url: "/collections/20",
                    resourceId: "gid://shopify/Collection/20",
                    tags: [],
                    items: [],
                },
                {
                    title: "Become an ambassador",
                    type: "HTTP",
                    url: "/apps/ambassador",
                },
            ],
        });
    });

    it("omits url and resourceId on items that have none", async () => {
        const main = menu("main-menu", [
            item("30", { type: "FRONTPAGE", url: "/", resourceId: null }),
            item("31", { type: "CATALOG", url: null, resourceId: null }),
        ]);
        respond({ menus: { nodes: [main] } });
        updated({ ...main, items: [...main.items, item("99")] });

        await addMenuLink(mockContext, { title: "x", url: "/apps/x" });

        const [frontpage, catalog] = sentUpdate().items;
        expect(frontpage).not.toHaveProperty("resourceId");
        expect(frontpage.url).toBe("/");
        expect(catalog).not.toHaveProperty("url");
        expect(catalog).not.toHaveProperty("resourceId");
    });

    it("returns null without an update when there is no main menu", async () => {
        respond({ menus: { nodes: [] } });
        expect(
            await addMenuLink(mockContext, { title: "x", url: "/apps/x" })
        ).toBeNull();
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("returns null when the update is rejected", async () => {
        respond({ menus: { nodes: [menu("main-menu", [])] } });
        respond({
            menuUpdate: {
                menu: null,
                userErrors: [{ code: "NOT_FOUND", message: "gone" }],
            },
        });
        expect(
            await addMenuLink(mockContext, { title: "x", url: "/apps/x" })
        ).toBeNull();
    });

    it("returns null when no new item appears in the updated menu", async () => {
        const main = menu("main-menu", [item("20")]);
        respond({ menus: { nodes: [main] } });
        updated(main);
        expect(
            await addMenuLink(mockContext, { title: "x", url: "/apps/x" })
        ).toBeNull();
    });
});

describe("removeMenuLinks", () => {
    const LINK = {
        menuId: "gid://shopify/Menu/1",
        itemId: "gid://shopify/MenuItem/99",
    };
    const FOOTER_LINK = {
        menuId: "gid://shopify/Menu/2",
        itemId: "gid://shopify/MenuItem/98",
    };

    it("drops the link and resends every other item with its id", async () => {
        const main = menu("main-menu", [item("20"), item("99")]);
        respond({ menu: main });
        updated(menu("main-menu", [item("20")]));

        expect(await removeMenuLinks(mockContext, [LINK])).toEqual([]);
        expect(sentUpdate().items).toEqual([
            {
                id: "gid://shopify/MenuItem/20",
                title: "Item 20",
                type: "COLLECTION",
                url: "/collections/20",
                resourceId: "gid://shopify/Collection/20",
                tags: [],
                items: [],
            },
        ]);
    });

    it("finds a link the merchant nested and moves its children up", async () => {
        const main = menu("main-menu", [
            item("20", { items: [item("99", { items: [item("21")] })] }),
        ]);
        respond({ menu: main });
        updated(main);

        expect(await removeMenuLinks(mockContext, [LINK])).toEqual([]);
        const [parent] = sentUpdate().items;
        expect(parent.items.map((child: { id: string }) => child.id)).toEqual([
            "gid://shopify/MenuItem/21",
        ]);
    });

    it("removes two links of one menu in a single update", async () => {
        const second = {
            menuId: LINK.menuId,
            itemId: "gid://shopify/MenuItem/97",
        };
        respond({
            menu: menu("main-menu", [item("97"), item("20"), item("99")]),
        });
        updated(menu("main-menu", [item("20")]));

        expect(await removeMenuLinks(mockContext, [LINK, second])).toEqual([]);
        expect(mockGraphql).toHaveBeenCalledTimes(2);
        expect(
            sentUpdate().items.map((child: { id: string }) => child.id)
        ).toEqual(["gid://shopify/MenuItem/20"]);
    });

    it("is done without an update when the link is already gone", async () => {
        respond({ menu: menu("main-menu", [item("20")]) });
        expect(await removeMenuLinks(mockContext, [LINK])).toEqual([]);
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("is done without an update when the menu is gone", async () => {
        respond({ menu: null });
        expect(await removeMenuLinks(mockContext, [LINK])).toEqual([]);
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("keeps the links of a menu that cannot be read, and still removes the others", async () => {
        mockGraphql.mockRejectedValueOnce(new Error("boom"));
        respond({ menu: menu("footer", [item("98")], "2") });
        updated(menu("footer", [], "2"));
        expect(await removeMenuLinks(mockContext, [LINK, FOOTER_LINK])).toEqual(
            [LINK]
        );
    });

    it("keeps the link when the update is rejected", async () => {
        respond({ menu: menu("main-menu", [item("99")]) });
        respond({ menuUpdate: { menu: null, userErrors: [] } });
        expect(await removeMenuLinks(mockContext, [LINK])).toEqual([LINK]);
    });
});

describe("presentMenuLinks", () => {
    const LINK = {
        menuId: "gid://shopify/Menu/1",
        itemId: "gid://shopify/MenuItem/99",
    };
    const GONE = {
        menuId: "gid://shopify/Menu/1",
        itemId: "gid://shopify/MenuItem/98",
    };

    it("lists the links nested anywhere in their menu, reading it once", async () => {
        respond({
            menu: menu("main-menu", [item("20", { items: [item("99")] })]),
        });
        expect(await presentMenuLinks(mockContext, [LINK, GONE])).toEqual([
            LINK,
        ]);
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("is empty when the menu is gone", async () => {
        respond({ menu: null });
        expect(await presentMenuLinks(mockContext, [LINK])).toEqual([]);
    });

    it("is null when a menu cannot be read", async () => {
        respond(undefined);
        expect(await presentMenuLinks(mockContext, [LINK])).toBeNull();
    });
});

describe("repointPageLinks", () => {
    const PAGE_ID = "gid://shopify/Page/7";
    const pageLink = (id: string, overrides: Partial<MenuItemNode> = {}) =>
        item(id, {
            title: "Ambassadors",
            type: "PAGE",
            url: "/pages/ambassadors",
            resourceId: PAGE_ID,
            tags: ["t"],
            ...overrides,
        });

    it("turns page links into HTTP links in every menu, keeping id, title, tags and children", async () => {
        respond({
            menus: {
                nodes: [
                    menu("main-menu", [
                        item("20", { items: [pageLink("40")] }),
                    ]),
                    menu(
                        "footer",
                        [pageLink("41", { items: [item("42")] })],
                        "2"
                    ),
                ],
            },
        });
        updated(menu("main-menu", []));
        updated(menu("footer", [], "2"));

        expect(
            await repointPageLinks(mockContext, {
                pageId: PAGE_ID,
                url: "/apps/ambassador",
            })
        ).toEqual({
            changed: [
                {
                    menuId: "gid://shopify/Menu/1",
                    itemId: "gid://shopify/MenuItem/40",
                },
                {
                    menuId: "gid://shopify/Menu/2",
                    itemId: "gid://shopify/MenuItem/41",
                },
            ],
            failed: false,
        });

        const updates = mockGraphql.mock.calls
            .filter(([query]) => String(query).includes("menuUpdate("))
            .map(([, options]) => options.variables);
        expect(updates[0].items[0].items[0]).toEqual({
            id: "gid://shopify/MenuItem/40",
            title: "Ambassadors",
            type: "HTTP",
            url: "/apps/ambassador",
            tags: ["t"],
            items: [],
        });
        expect(updates[1].handle).toBe("footer");
        expect(updates[1].items[0]).toMatchObject({
            id: "gid://shopify/MenuItem/41",
            type: "HTTP",
            url: "/apps/ambassador",
            items: [{ id: "gid://shopify/MenuItem/42", type: "COLLECTION" }],
        });
        expect(updates[1].items[0]).not.toHaveProperty("resourceId");
    });

    it("leaves menus without a link to the page alone", async () => {
        respond({
            menus: {
                nodes: [
                    menu("main-menu", [
                        pageLink("40", { resourceId: "gid://shopify/Page/8" }),
                        item("20"),
                    ]),
                ],
            },
        });
        expect(
            await repointPageLinks(mockContext, {
                pageId: PAGE_ID,
                url: "/apps/ambassador",
            })
        ).toEqual({ changed: [], failed: false });
        expect(mockGraphql).toHaveBeenCalledOnce();
    });

    it("reports a rejected menu as failed and keeps the links changed in the others", async () => {
        respond({
            menus: {
                nodes: [
                    menu("main-menu", [pageLink("40")]),
                    menu("footer", [pageLink("41")], "2"),
                ],
            },
        });
        respond({ menuUpdate: { menu: null, userErrors: [] } });
        updated(menu("footer", [], "2"));
        expect(
            await repointPageLinks(mockContext, {
                pageId: PAGE_ID,
                url: "/apps/ambassador",
            })
        ).toEqual({
            changed: [
                {
                    menuId: "gid://shopify/Menu/2",
                    itemId: "gid://shopify/MenuItem/41",
                },
            ],
            failed: true,
        });
    });

    it("is failed with nothing changed when the menus cannot be listed", async () => {
        mockGraphql.mockRejectedValueOnce(new Error("boom"));
        expect(
            await repointPageLinks(mockContext, {
                pageId: PAGE_ID,
                url: "/apps/ambassador",
            })
        ).toEqual({ changed: [], failed: true });
    });
});
