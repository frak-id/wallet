import type { AuthenticatedContext } from "../types/context";
import { log } from "./logger";
import {
    getAmbassadorPageMetafield,
    writeAmbassadorPageMetafield,
} from "./metafields";
import { arePageScopesGranted } from "./pageScopes";
import { shopInfo } from "./shop";

export type AmbassadorPageLanguage = "en" | "fr";

export type AmbassadorPageRef = {
    id: string;
    handle: string;
};

const AMBASSADOR_PAGE_BODY = "<frak-ambassador></frak-ambassador>";
const MAX_HANDLE_ATTEMPTS = 5;
const PAGES_LISTING_SIZE = 250;

const PAGE_COPY: Record<
    AmbassadorPageLanguage,
    { title: string; handle: string }
> = {
    en: { title: "Become an ambassador", handle: "become-an-ambassador" },
    fr: { title: "Devenir ambassadeur", handle: "devenir-ambassadeur" },
};

type PageCreateUserError = { code?: string; message: string };

type PageCreateData = {
    pageCreate?: {
        page?: AmbassadorPageRef | null;
        userErrors?: PageCreateUserError[];
    } | null;
};

/**
 * Create the published ambassador page on the default template. A handle that
 * is `TAKEN` is retried with `-2` to `-5`; `null` on any other failure.
 */
export async function createAmbassadorPage(
    context: AuthenticatedContext,
    language: AmbassadorPageLanguage
): Promise<AmbassadorPageRef | null> {
    const { title, handle } = PAGE_COPY[language];

    try {
        for (let attempt = 1; attempt <= MAX_HANDLE_ATTEMPTS; attempt += 1) {
            const response = await context.admin.graphql(
                `#graphql
mutation pageCreate($page: PageCreateInput!) {
  pageCreate(page: $page) {
    page {
      id
      handle
    }
    userErrors {
      code
      field
      message
    }
  }
}`,
                {
                    variables: {
                        page: {
                            title,
                            handle:
                                attempt === 1 ? handle : `${handle}-${attempt}`,
                            body: AMBASSADOR_PAGE_BODY,
                            isPublished: true,
                        },
                    },
                }
            );
            const { data } = (await response.json()) as {
                data?: PageCreateData;
            };
            const result = data?.pageCreate;
            if (result?.page) {
                return result.page;
            }

            const userErrors = result?.userErrors ?? [];
            const isTaken = userErrors.some((error) => error.code === "TAKEN");
            if (!isTaken) {
                log.error({ userErrors }, "ambassador page create rejected");
                return null;
            }
        }
        log.warn("ambassador page handles all taken");
        return null;
    } catch (error) {
        log.error({ err: error }, "ambassador page create error");
        return null;
    }
}

/**
 * Storefront URL of a page: the shop's primary domain plus the page handle.
 */
export async function buildAmbassadorPageUrl(
    context: AuthenticatedContext,
    handle: string
): Promise<string> {
    const { primaryDomain } = await shopInfo(context);
    return `${primaryDomain.url}/pages/${handle}`;
}

/** `url` is null when the page is missing or unpublished; `ok: false` means it could not be read. */
export type AmbassadorPageUrlResult =
    | { ok: true; url: string | null }
    | { ok: false };

/**
 * Current storefront URL of a recorded page. A read failure is reported
 * apart from a missing page, so callers never clear a live URL on a blip.
 */
export async function resolveAmbassadorPageUrl(
    context: AuthenticatedContext,
    pageId: string
): Promise<AmbassadorPageUrlResult> {
    try {
        const response = await context.admin.graphql(
            `#graphql
query getAmbassadorPage($id: ID!) {
  page(id: $id) {
    handle
    isPublished
  }
}`,
            { variables: { id: pageId } }
        );
        const { data } = (await response.json()) as {
            data?: {
                page?: { handle: string; isPublished: boolean } | null;
            };
        };
        if (data === undefined) {
            return { ok: false };
        }
        const page = data.page;
        if (!page?.isPublished) {
            return { ok: true, url: null };
        }
        return {
            ok: true,
            url: await buildAmbassadorPageUrl(context, page.handle),
        };
    } catch (error) {
        log.error({ err: error, pageId }, "ambassador page read error");
        return { ok: false };
    }
}

type ListedPage = AmbassadorPageRef & {
    isPublished: boolean;
    templateSuffix: string | null;
    body: string;
};

/**
 * The most recently updated published page among the latest 250 that
 * `matches`, or `null`: the `pages` query has no filter to match server-side.
 */
async function findPublishedPage(
    context: AuthenticatedContext,
    matches: (page: ListedPage) => boolean
): Promise<AmbassadorPageRef | null> {
    try {
        const response = await context.admin.graphql(
            `#graphql
query listPages($first: Int!) {
  pages(first: $first, sortKey: UPDATED_AT, reverse: true) {
    nodes {
      id
      handle
      isPublished
      templateSuffix
      body
    }
  }
}`,
            { variables: { first: PAGES_LISTING_SIZE } }
        );
        const { data } = (await response.json()) as {
            data?: {
                pages?: { nodes: ListedPage[] } | null;
            };
        };
        const match = data?.pages?.nodes.find(
            (page) => page.isPublished && matches(page)
        );
        return match ? { id: match.id, handle: match.handle } : null;
    } catch (error) {
        log.error({ err: error }, "ambassador page listing error");
        return null;
    }
}

/** The most recently updated published page whose template suffix is in `suffixes`, or `null`. */
export async function findPublishedPageByTemplateSuffixes(
    context: AuthenticatedContext,
    suffixes: string[]
): Promise<AmbassadorPageRef | null> {
    return findPublishedPage(
        context,
        (page) =>
            page.templateSuffix !== null &&
            suffixes.includes(page.templateSuffix)
    );
}

export type AmbassadorCardState =
    | { state: "linked"; url: string }
    | { state: "blockUnlinked" }
    | { state: "none" };

/**
 * Card state for the shop's ambassador page. With the page scopes granted, a
 * changed storefront URL is written back to the record.
 */
export async function reconcileAmbassadorPage(
    context: AuthenticatedContext,
    templateSuffixes: string[]
): Promise<AmbassadorCardState> {
    const unlinked: AmbassadorCardState =
        templateSuffixes.length > 0
            ? { state: "blockUnlinked" }
            : { state: "none" };

    try {
        const record = await getAmbassadorPageMetafield(context);
        if (!record) {
            return unlinked;
        }

        const recordedState: AmbassadorCardState = record.url
            ? { state: "linked", url: record.url }
            : unlinked;
        if (!(await arePageScopesGranted(context))) {
            return recordedState;
        }

        const resolved = await resolveAmbassadorPageUrl(context, record.pageId);
        if (!resolved.ok) {
            return recordedState;
        }

        if (resolved.url !== record.url) {
            await writeAmbassadorPageMetafield(context, {
                pageId: record.pageId,
                url: resolved.url,
            });
        }
        return resolved.url ? { state: "linked", url: resolved.url } : unlinked;
    } catch (error) {
        log.error({ err: error }, "ambassador page reconcile error");
        return unlinked;
    }
}
