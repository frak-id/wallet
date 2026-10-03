import { LRUCache } from "lru-cache";
import type { AuthenticatedContext } from "../types/context";
import {
    type AmbassadorMenuState,
    type AmbassadorPageActionResult,
    type AmbassadorPageLanguage,
    type AmbassadorPageOverview,
    type AmbassadorPageStatus,
    type AmbassadorPageWarning,
    type AmbassadorProbe,
    ambassadorMenuTitle,
    ambassadorProxyPath,
} from "../utils/ambassadorPage";
import { runAdminGraphql } from "./adminGraphql";
import { log } from "./logger";
import {
    type AmbassadorPageRecordV2,
    getAmbassadorPageMetafield,
    writeAmbassadorPageMetafield,
} from "./metafields";
import {
    addMenuLink,
    type MenuLink,
    presentMenuLinks,
    removeMenuLinks,
    repointPageLinks,
} from "./navigation";
import {
    type GrantedOptionalScopes,
    grantedOptionalScopes,
} from "./optionalScopes";
import { shopInfo } from "./shop";

type Legacy = NonNullable<AmbassadorPageRecordV2["legacy"]>;

const NO_SCOPES: GrantedOptionalScopes = {
    proxy: false,
    menu: false,
    pages: false,
};

/** The marker `proxy/ambassador.liquid` renders only on the live page. */
const LIVE_PAGE_MARKER = "data-frak-amb-page";
const PROBE_TIMEOUT_MS = 4000;

export type ParsedAmbassadorRecord =
    | { kind: "none" }
    | { kind: "oldPage"; pageId: string; url: string | null }
    | { kind: "proxy"; record: AmbassadorPageRecordV2 };

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function asMenuLinks(value: unknown): MenuLink[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((link) =>
        isObject(link) &&
        typeof link.menuId === "string" &&
        typeof link.itemId === "string"
            ? [{ menuId: link.menuId, itemId: link.itemId }]
            : []
    );
}

function asLegacy(value: unknown): Legacy | undefined {
    if (
        !(
            isObject(value) &&
            typeof value.pageId === "string" &&
            typeof value.switchedAt === "string"
        )
    ) {
        return undefined;
    }
    return {
        pageId: value.pageId,
        switchedAt: value.switchedAt,
        ...(typeof value.handle === "string" ? { handle: value.handle } : {}),
        ...(typeof value.redirectId === "string"
            ? { redirectId: value.redirectId }
            : {}),
    };
}

/** Shape-check the stored JSON: `v: 2` is the proxy page, a `pageId` an old `/pages/` page. */
export function parseAmbassadorRecord(raw: unknown): ParsedAmbassadorRecord {
    if (!isObject(raw)) return { kind: "none" };
    if (raw.v === 2) {
        const menuLinks = asMenuLinks(raw.menuLinks);
        const legacy = asLegacy(raw.legacy);
        return {
            kind: "proxy",
            record: {
                v: 2,
                published: raw.published === true,
                ...(typeof raw.publishedAt === "string"
                    ? { publishedAt: raw.publishedAt }
                    : {}),
                ...(menuLinks.length ? { menuLinks } : {}),
                ...(legacy ? { legacy } : {}),
            },
        };
    }
    if (typeof raw.pageId === "string") {
        return {
            kind: "oldPage",
            pageId: raw.pageId,
            url: typeof raw.url === "string" ? raw.url : null,
        };
    }
    return { kind: "none" };
}

/** `null` when the metafield could not be read, so a blip never reads as "no page". */
async function readRecord(
    context: AuthenticatedContext
): Promise<ParsedAmbassadorRecord | null> {
    try {
        return parseAmbassadorRecord(await getAmbassadorPageMetafield(context));
    } catch (err) {
        log.error({ err }, "ambassador record read failed");
        return null;
    }
}

async function writeRecord(
    context: AuthenticatedContext,
    record: AmbassadorPageRecordV2
): Promise<boolean> {
    try {
        const result = await writeAmbassadorPageMetafield(context, record);
        if (!result.success) {
            log.error(
                { userErrors: result.userErrors },
                "ambassador record write rejected"
            );
        }
        return result.success;
    } catch (err) {
        log.error({ err }, "ambassador record write failed");
        return false;
    }
}

/** Storefront URL of the proxy page, `undefined` when the shop cannot be read. */
async function proxyPageUrl(
    context: AuthenticatedContext
): Promise<string | undefined> {
    try {
        const { primaryDomain } = await shopInfo(context);
        return `${primaryDomain.url}${ambassadorProxyPath()}`;
    } catch (err) {
        log.error({ err }, "ambassador page url failed");
        return undefined;
    }
}

function statusOf(parsed: ParsedAmbassadorRecord): AmbassadorPageStatus {
    switch (parsed.kind) {
        case "none":
            return "draft";
        case "oldPage":
            return "oldPage";
        case "proxy":
            if (parsed.record.published) return "live";
            return parsed.record.publishedAt ? "hidden" : "draft";
    }
}

/** Status from one metafield read; `undefined` when it cannot be read. */
export async function getAmbassadorPageStatus(
    context: AuthenticatedContext
): Promise<AmbassadorPageStatus | undefined> {
    const parsed = await readRecord(context);
    return parsed ? statusOf(parsed) : undefined;
}

/** `none` without recorded links or the menu scope, and when a menu cannot be read. */
async function menuStateOf(
    context: AuthenticatedContext,
    parsed: ParsedAmbassadorRecord,
    scopes: GrantedOptionalScopes
): Promise<AmbassadorMenuState> {
    const links =
        parsed.kind === "proxy" ? (parsed.record.menuLinks ?? []) : [];
    if (links.length === 0 || !scopes.menu) return "none";
    const present = await presentMenuLinks(context, links);
    if (present === null) return "none";
    return present.length > 0 ? "added" : "missing";
}

/** Everything the ambassador screen shows; `null` when the record or the shop cannot be read. */
export async function getAmbassadorPageOverview(
    context: AuthenticatedContext
): Promise<AmbassadorPageOverview | null> {
    const [parsed, url, granted] = await Promise.all([
        readRecord(context),
        proxyPageUrl(context),
        grantedOptionalScopes(context),
    ]);
    if (!(parsed && url)) return null;

    const scopes = granted ?? NO_SCOPES;
    return {
        status: statusOf(parsed),
        url,
        path: ambassadorProxyPath(),
        oldPageUrl: parsed.kind === "oldPage" ? parsed.url : null,
        menu: { state: await menuStateOf(context, parsed, scopes) },
        scopes,
    };
}

/** `present` while a recorded link is still in a menu, else the link just added; `null` when none could be added. */
async function ensureMenuLink(
    context: AuthenticatedContext,
    record: AmbassadorPageRecordV2,
    language: AmbassadorPageLanguage
): Promise<"present" | MenuLink | null> {
    const recorded = record.menuLinks ?? [];
    if (recorded.length > 0) {
        const present = await presentMenuLinks(context, recorded);
        // An unreadable menu may still hold a link: never risk a duplicate.
        if (present === null) return null;
        if (present.length > 0) return "present";
    }
    return addMenuLink(context, {
        title: ambassadorMenuTitle(language),
        url: ambassadorProxyPath(),
    });
}

/** Make sure a menu links to the page; a link that cannot be recorded is removed again, never orphaned. */
async function linkFromMenu(
    context: AuthenticatedContext,
    record: AmbassadorPageRecordV2,
    language: AmbassadorPageLanguage
): Promise<boolean> {
    const link = await ensureMenuLink(context, record, language);
    if (link === "present") return true;
    if (!link) return false;
    if (await writeRecord(context, { ...record, menuLinks: [link] })) {
        return true;
    }
    await removeMenuLinks(context, [link]);
    return false;
}

/**
 * Publish the proxy page, keeping the first `publishedAt`. The record is
 * written before the menu is touched: a menu failure never fails the publish.
 */
export async function publishAmbassadorPage(
    context: AuthenticatedContext,
    {
        addToMenu,
        language,
    }: { addToMenu: boolean; language: AmbassadorPageLanguage }
): Promise<AmbassadorPageActionResult> {
    const intent = "publish";
    const [parsed, scopes] = await Promise.all([
        readRecord(context),
        grantedOptionalScopes(context),
    ]);
    if (!(parsed && scopes)) return { ok: false, intent, error: "failed" };
    if (!scopes.proxy) return { ok: false, intent, error: "scopeMissing" };
    // An old page moves over through the switch, which also redirects it.
    if (parsed.kind === "oldPage") {
        return { ok: false, intent, error: "invalid" };
    }

    const previous: AmbassadorPageRecordV2 =
        parsed.kind === "proxy" ? parsed.record : { v: 2, published: false };
    const record: AmbassadorPageRecordV2 = {
        ...previous,
        v: 2,
        published: true,
        publishedAt: previous.publishedAt ?? new Date().toISOString(),
    };
    if (!(await writeRecord(context, record))) {
        return { ok: false, intent, error: "failed" };
    }

    const url = await proxyPageUrl(context);
    if (!addToMenu) return { ok: true, intent, url };
    if (!scopes.menu) return { ok: true, intent, url, menu: "skipped" };
    const linked = await linkFromMenu(context, record, language);
    return { ok: true, intent, url, menu: linked ? "added" : "failed" };
}

/** Unpublish the page and remove every recorded menu link to it. */
export async function hideAmbassadorPage(
    context: AuthenticatedContext
): Promise<AmbassadorPageActionResult> {
    const intent = "hide";
    const [parsed, scopes] = await Promise.all([
        readRecord(context),
        grantedOptionalScopes(context),
    ]);
    if (!(parsed && scopes)) return { ok: false, intent, error: "failed" };
    if (parsed.kind !== "proxy") return { ok: false, intent, error: "invalid" };

    const { menuLinks = [], ...rest } = parsed.record;
    let kept = menuLinks;
    if (menuLinks.length > 0 && scopes.menu) {
        kept = await removeMenuLinks(context, menuLinks);
    }
    const record: AmbassadorPageRecordV2 = {
        ...rest,
        published: false,
        ...(kept.length > 0 ? { menuLinks: kept } : {}),
    };
    if (!(await writeRecord(context, record))) {
        return { ok: false, intent, error: "failed" };
    }
    return kept.length > 0
        ? { ok: true, intent, warnings: ["menuRemoveFailed"] }
        : { ok: true, intent };
}

/** Add the main-menu link to an existing proxy page, unless a recorded one is still there. */
export async function addAmbassadorMenuLink(
    context: AuthenticatedContext,
    { language }: { language: AmbassadorPageLanguage }
): Promise<AmbassadorPageActionResult> {
    const intent = "addToMenu";
    const [parsed, scopes] = await Promise.all([
        readRecord(context),
        grantedOptionalScopes(context),
    ]);
    if (!(parsed && scopes)) return { ok: false, intent, error: "failed" };
    if (!scopes.menu) return { ok: false, intent, error: "scopeMissing" };
    if (parsed.kind !== "proxy") return { ok: false, intent, error: "invalid" };

    if (!(await linkFromMenu(context, parsed.record, language))) {
        return { ok: false, intent, error: "failed" };
    }
    return { ok: true, intent, menu: "added" };
}

type PageRef = { id: string; handle: string };

async function readPage(
    context: AuthenticatedContext,
    pageId: string
): Promise<PageRef | null> {
    const data = await runAdminGraphql<{ page?: PageRef | null }>(
        context,
        "ambassador old page",
        `#graphql
query frakAmbassadorOldPage($id: ID!) {
  page(id: $id) {
    id
    handle
  }
}`,
        { id: pageId }
    );
    return data?.page ?? null;
}

/** Rename and unpublish the v1 page, never delete it; the id suffix keeps the new handle free. */
async function retireOldPage(
    context: AuthenticatedContext,
    page: PageRef
): Promise<boolean> {
    const numericId = page.id.split("/").pop();
    const data = await runAdminGraphql<{
        pageUpdate?: {
            page?: { id: string } | null;
            userErrors?: Array<{ code?: string; message: string }>;
        } | null;
    }>(
        context,
        "ambassador old page retire",
        `#graphql
mutation frakAmbassadorRetirePage($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) {
    page {
      id
    }
    userErrors {
      code
      message
    }
  }
}`,
        {
            id: page.id,
            page: {
                isPublished: false,
                handle: `${page.handle}-previous-${numericId}`,
                redirectNewHandle: false,
            },
        }
    );
    if (!data?.pageUpdate?.page) {
        log.error(
            { pageId: page.id, userErrors: data?.pageUpdate?.userErrors },
            "ambassador old page retire rejected"
        );
        return false;
    }
    return true;
}

type UrlRedirectNode = { id: string; path: string; target: string };

/** The redirect already set on `path`, `null` when there is none or the lookup fails. */
async function findRedirect(
    context: AuthenticatedContext,
    path: string
): Promise<UrlRedirectNode | null> {
    const data = await runAdminGraphql<{
        urlRedirects?: { nodes: UrlRedirectNode[] };
    }>(
        context,
        "ambassador redirect lookup",
        `#graphql
query frakAmbassadorRedirectLookup($query: String!) {
  urlRedirects(first: 10, query: $query) {
    nodes {
      id
      path
      target
    }
  }
}`,
        { query: `path:${JSON.stringify(path)}` }
    );
    const wanted = path.toLowerCase();
    return (
        data?.urlRedirects?.nodes.find(
            (node) => node.path.toLowerCase() === wanted
        ) ?? null
    );
}

/** Whether a redirect target, relative or absolute, is the proxy page. */
function isProxyTarget(target: string): boolean {
    const base = "https://shop.invalid";
    if (!URL.canParse(target, base)) return false;
    const { pathname } = new URL(target, base);
    return pathname.replace(/\/$/, "") === ambassadorProxyPath();
}

/** Redirect the v1 page path; a path already redirected to the proxy page counts as done, with no id to record. */
async function redirectOldPath(
    context: AuthenticatedContext,
    path: string
): Promise<{ ok: boolean; redirectId?: string }> {
    const data = await runAdminGraphql<{
        urlRedirectCreate?: {
            urlRedirect?: { id: string } | null;
            userErrors?: Array<{ code?: string; message: string }>;
        } | null;
    }>(
        context,
        "ambassador old page redirect",
        `#graphql
mutation frakAmbassadorRedirect($urlRedirect: UrlRedirectInput!) {
  urlRedirectCreate(urlRedirect: $urlRedirect) {
    urlRedirect {
      id
    }
    userErrors {
      code
      message
    }
  }
}`,
        { urlRedirect: { path, target: ambassadorProxyPath() } }
    );
    const result = data?.urlRedirectCreate;
    if (result?.urlRedirect) {
        return { ok: true, redirectId: result.urlRedirect.id };
    }
    const userErrors = result?.userErrors ?? [];
    if (
        userErrors.some((error) =>
            /taken|already exists|duplicate/i.test(error.message)
        )
    ) {
        const existing = await findRedirect(context, path);
        if (existing && isProxyTarget(existing.target)) return { ok: true };
        log.warn(
            { path, target: existing?.target },
            "ambassador redirect path taken"
        );
        return { ok: false };
    }
    log.error({ path, userErrors }, "ambassador redirect rejected");
    return { ok: false };
}

/** The handle in the `/pages/<handle>` URL a v1 record stores. */
function handleFromUrl(url: string | null): string | undefined {
    return url ? /\/pages\/([^/?#]+)/.exec(url)?.[1] : undefined;
}

/** Steps 2-4 of the switch: repoint menu links, retire the v1 page, redirect its path. */
async function moveOldPage(
    context: AuthenticatedContext,
    legacy: Legacy
): Promise<{
    legacy: Legacy;
    repointed: MenuLink[];
    warnings: AmbassadorPageWarning[];
}> {
    const warnings: AmbassadorPageWarning[] = [];
    const repoint = await repointPageLinks(context, {
        pageId: legacy.pageId,
        url: ambassadorProxyPath(),
    });
    if (repoint.failed) warnings.push("repointFailed");

    const page = await readPage(context, legacy.pageId);
    if (page && !(await retireOldPage(context, page))) {
        warnings.push("oldPageHideFailed");
    }
    const handle = page?.handle ?? legacy.handle;
    const redirect = handle
        ? await redirectOldPath(context, `/pages/${handle}`)
        : { ok: false };
    if (!redirect.ok) warnings.push("redirectFailed");

    return {
        legacy: {
            ...legacy,
            ...(handle ? { handle } : {}),
            ...(redirect.redirectId ? { redirectId: redirect.redirectId } : {}),
        },
        repointed: repoint.changed,
        warnings,
    };
}

/** Repointed links already lead to the new page, so no link is added. */
function switchMenuResult(
    repointed: boolean,
    added: boolean
): "added" | "failed" | "skipped" {
    if (repointed) return "skipped";
    return added ? "added" : "failed";
}

/** The switch's first write: the page published, and the v1 page it replaces. */
function switchStartRecord(oldPage: {
    pageId: string;
    url: string | null;
}): AmbassadorPageRecordV2 & { legacy: Legacy } {
    const switchedAt = new Date().toISOString();
    const handle = handleFromUrl(oldPage.url);
    return {
        v: 2,
        published: true,
        publishedAt: switchedAt,
        legacy: {
            pageId: oldPage.pageId,
            switchedAt,
            ...(handle ? { handle } : {}),
        },
    };
}

/**
 * Move a v1 `/pages/` page to the proxy page. The first write publishes and
 * records the legacy page, so a switch cut short still knows what it moved;
 * the later steps only refine it. Only that first write can fail the switch.
 */
export async function switchToFullWidthPage(
    context: AuthenticatedContext,
    {
        addToMenu,
        language,
    }: { addToMenu: boolean; language: AmbassadorPageLanguage }
): Promise<AmbassadorPageActionResult> {
    const intent = "switch";
    const [parsed, scopes] = await Promise.all([
        readRecord(context),
        grantedOptionalScopes(context),
    ]);
    if (!(parsed && scopes)) return { ok: false, intent, error: "failed" };
    if (!(scopes.proxy && scopes.menu && scopes.pages)) {
        return { ok: false, intent, error: "scopeMissing" };
    }
    if (parsed.kind !== "oldPage") {
        return { ok: false, intent, error: "invalid" };
    }

    const started = switchStartRecord(parsed);
    if (!(await writeRecord(context, started))) {
        return { ok: false, intent, error: "failed" };
    }

    const { legacy, repointed, warnings } = await moveOldPage(
        context,
        started.legacy
    );
    const added =
        addToMenu && repointed.length === 0
            ? await addMenuLink(context, {
                  title: ambassadorMenuTitle(language),
                  url: ambassadorProxyPath(),
              })
            : null;
    const menuLinks = added ? [...repointed, added] : repointed;

    const recorded = await writeRecord(context, {
        ...started,
        legacy,
        ...(menuLinks.length > 0 ? { menuLinks } : {}),
    });
    if (!recorded) {
        warnings.push("recordFailed");
        if (added) await removeMenuLinks(context, [added]);
    }

    return {
        ok: true,
        intent,
        url: await proxyPageUrl(context),
        ...(addToMenu
            ? {
                  menu: switchMenuResult(
                      repointed.length > 0,
                      added !== null && recorded
                  ),
              }
            : {}),
        ...(warnings.length ? { warnings } : {}),
    };
}

const probeCache = new LRUCache<string, AmbassadorProbe>({
    max: 512,
    ttl: 60_000,
});

async function fetchProbe(url: string): Promise<AmbassadorProbe> {
    try {
        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        if (response.status === 401) return "locked";
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location") ?? "";
            return location.includes("/password") ? "locked" : "unknown";
        }
        if (response.status === 404) return "missing";
        if (response.status !== 200) return "unknown";
        const body = await response.text();
        return body.includes(LIVE_PAGE_MARKER) ? "live" : "missing";
    } catch (err) {
        log.warn({ err, url }, "ambassador page probe failed");
        return "unknown";
    }
}

/** What a visitor gets at `url`; only `live` is cached (60s), so a fixed problem clears on the next visit. */
export async function probeAmbassadorPage(
    url: string
): Promise<AmbassadorProbe> {
    const cached = probeCache.get(url);
    if (cached) return cached;
    const probe = await fetchProbe(url);
    if (probe === "live") probeCache.set(url, probe);
    return probe;
}
