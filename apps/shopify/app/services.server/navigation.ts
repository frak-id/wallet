import type { AuthenticatedContext } from "../types/context";
import { runAdminGraphql } from "./adminGraphql";
import { log } from "./logger";

const MAIN_MENU_HANDLE = "main-menu";
const MENUS_PAGE_SIZE = 250;

export type MenuItemNode = {
    id: string;
    title: string;
    type: string;
    url: string | null;
    resourceId: string | null;
    tags: string[];
    /** Absent on the third level, the deepest a menu can nest. */
    items?: MenuItemNode[];
};

export type MenuLink = { menuId: string; itemId: string };

export type MenuNode = {
    id: string;
    handle: string;
    title: string;
    items: MenuItemNode[];
};

type MenuItemInput = {
    id?: string;
    title: string;
    type: string;
    url?: string;
    resourceId?: string;
    tags?: string[];
    items?: MenuItemInput[];
};

const MENU_FIELDS = `#graphql
fragment FrakMenuItem on MenuItem {
  id
  title
  type
  url
  resourceId
  tags
}
fragment FrakMenu on Menu {
  id
  handle
  title
  items {
    ...FrakMenuItem
    items {
      ...FrakMenuItem
      items {
        ...FrakMenuItem
      }
    }
  }
}`;

async function listMenus(
    context: AuthenticatedContext
): Promise<MenuNode[] | null> {
    const data = await runAdminGraphql<{ menus?: { nodes: MenuNode[] } }>(
        context,
        "menus",
        `${MENU_FIELDS}
query frakMenus($first: Int!) {
  menus(first: $first) {
    nodes {
      ...FrakMenu
    }
  }
}`,
        { first: MENUS_PAGE_SIZE }
    );
    return data?.menus?.nodes ?? null;
}

/** `undefined` when the menu was deleted, `null` when it could not be read. */
async function readMenu(
    context: AuthenticatedContext,
    menuId: string
): Promise<MenuNode | null | undefined> {
    const data = await runAdminGraphql<{ menu?: MenuNode | null }>(
        context,
        "menu",
        `${MENU_FIELDS}
query frakMenu($id: ID!) {
  menu(id: $id) {
    ...FrakMenu
  }
}`,
        { id: menuId }
    );
    if (!data) return null;
    return data.menu ?? undefined;
}

/**
 * Rebuild `items` as `menuUpdate` input, each item keeping its id so
 * the update leaves it untouched. `edit` returns what replaces an item (its
 * children already rebuilt): `[input]` to keep it, `[]` to drop it.
 */
function rebuildTree(
    items: MenuItemNode[],
    edit: (item: MenuItemNode, input: MenuItemInput) => MenuItemInput[] = (
        _item,
        input
    ) => [input]
): MenuItemInput[] {
    return items.flatMap((item) =>
        edit(item, {
            id: item.id,
            title: item.title,
            type: item.type,
            ...(item.url !== null ? { url: item.url } : {}),
            ...(item.resourceId !== null
                ? { resourceId: item.resourceId }
                : {}),
            tags: item.tags,
            ...(item.items ? { items: rebuildTree(item.items, edit) } : {}),
        })
    );
}

/** Replace the whole tree of `menu` with `items`; the handle is resent unchanged (a default menu's cannot change). */
async function updateMenu(
    context: AuthenticatedContext,
    menu: MenuNode,
    items: MenuItemInput[]
): Promise<MenuNode | null> {
    const data = await runAdminGraphql<{
        menuUpdate?: {
            menu?: MenuNode | null;
            userErrors?: Array<{ code?: string; message: string }>;
        } | null;
    }>(
        context,
        "menuUpdate",
        `${MENU_FIELDS}
mutation frakMenuUpdate($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
    menu {
      ...FrakMenu
    }
    userErrors {
      code
      message
    }
  }
}`,
        { id: menu.id, title: menu.title, handle: menu.handle, items }
    );
    const result = data?.menuUpdate;
    if (!result?.menu) {
        log.error(
            { menuId: menu.id, userErrors: result?.userErrors },
            "menu update rejected"
        );
        return null;
    }
    return result.menu;
}

function containsItem(items: MenuItemNode[], itemId: string): boolean {
    return items.some(
        (item) => item.id === itemId || containsItem(item.items ?? [], itemId)
    );
}

/** The theme's default `main-menu`, or `null` when missing or unreadable. */
export async function findMainMenu(
    context: AuthenticatedContext
): Promise<MenuNode | null> {
    const menus = await listMenus(context);
    return menus?.find((menu) => menu.handle === MAIN_MENU_HANDLE) ?? null;
}

/** Append an HTTP link to the main menu; the new item is the top-level id the previous tree did not have. */
export async function addMenuLink(
    context: AuthenticatedContext,
    { title, url }: { title: string; url: string }
): Promise<MenuLink | null> {
    const menu = await findMainMenu(context);
    if (!menu) return null;

    const previousIds = new Set(menu.items.map((item) => item.id));
    const updated = await updateMenu(context, menu, [
        ...rebuildTree(menu.items),
        { title, type: "HTTP", url },
    ]);
    const added = updated?.items.find((item) => !previousIds.has(item.id));
    if (!(updated && added)) {
        if (updated) log.error({ menuId: menu.id }, "menu link not found");
        return null;
    }
    return { menuId: updated.id, itemId: added.id };
}

/** Group links by menu, keeping their order. */
function byMenu(links: MenuLink[]): Map<string, Set<string>> {
    const groups = new Map<string, Set<string>>();
    for (const { menuId, itemId } of links) {
        const items = groups.get(menuId) ?? new Set<string>();
        items.add(itemId);
        groups.set(menuId, items);
    }
    return groups;
}

/**
 * Remove the links wherever the merchant moved them, one update per menu;
 * their children move up in their place. Returns the links still in place
 * because their menu could not be read or updated.
 */
export async function removeMenuLinks(
    context: AuthenticatedContext,
    links: MenuLink[]
): Promise<MenuLink[]> {
    const kept: MenuLink[] = [];
    for (const [menuId, itemIds] of byMenu(links)) {
        const menu = await readMenu(context, menuId);
        if (menu === undefined) continue;
        const present =
            menu === null
                ? [...itemIds]
                : [...itemIds].filter((id) => containsItem(menu.items, id));
        if (present.length === 0) continue;
        const removed =
            menu !== null &&
            (await updateMenu(
                context,
                menu,
                rebuildTree(menu.items, (item, input) =>
                    itemIds.has(item.id) ? (input.items ?? []) : [input]
                )
            )) !== null;
        if (!removed) {
            kept.push(...present.map((itemId) => ({ menuId, itemId })));
        }
    }
    return kept;
}

/** The links still anywhere in their menu; `null` when a menu could not be read. */
export async function presentMenuLinks(
    context: AuthenticatedContext,
    links: MenuLink[]
): Promise<MenuLink[] | null> {
    const present: MenuLink[] = [];
    for (const [menuId, itemIds] of byMenu(links)) {
        const menu = await readMenu(context, menuId);
        if (menu === null) return null;
        if (menu === undefined) continue;
        for (const itemId of itemIds) {
            if (containsItem(menu.items, itemId)) {
                present.push({ menuId, itemId });
            }
        }
    }
    return present;
}

/**
 * Turn every menu item linking to the page `pageId` into an HTTP link to
 * `url`, keeping its id, title, tags and children. `changed` lists the items
 * updated across all menus; `failed` is set when a menu could not be listed or updated.
 */
export async function repointPageLinks(
    context: AuthenticatedContext,
    { pageId, url }: { pageId: string; url: string }
): Promise<{ changed: MenuLink[]; failed: boolean }> {
    const menus = await listMenus(context);
    if (!menus) return { changed: [], failed: true };

    const changed: MenuLink[] = [];
    let failed = false;
    for (const menu of menus) {
        const inMenu: MenuLink[] = [];
        const items = rebuildTree(menu.items, (item, input) => {
            if (item.type !== "PAGE" || item.resourceId !== pageId) {
                return [input];
            }
            inMenu.push({ menuId: menu.id, itemId: item.id });
            const { resourceId: _resourceId, ...link } = input;
            return [{ ...link, type: "HTTP", url }];
        });
        if (inMenu.length === 0) continue;
        if (await updateMenu(context, menu, items)) {
            changed.push(...inMenu);
        } else {
            failed = true;
        }
    }
    return { changed, failed };
}
