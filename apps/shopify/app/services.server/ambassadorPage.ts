import type { AuthenticatedContext } from "../types/context";
import { log } from "./logger";
import {
    type AmbassadorPageRecord,
    getAmbassadorPageMetafield,
    writeAmbassadorPageMetafield,
} from "./metafields";
import { arePageScopesGranted } from "./pageScopes";
import { shopInfo } from "./shop";
import { getThemeBlockPresence, pickAmbassadorTemplate } from "./theme";

export type AmbassadorPageLanguage = "en" | "fr";

/** `fr` for any French locale tag, `en` otherwise. */
export function normalizeAmbassadorPageLanguage(
    language: FormDataEntryValue | null
): AmbassadorPageLanguage {
    return typeof language === "string" &&
        language.toLowerCase().startsWith("fr")
        ? "fr"
        : "en";
}

export type AmbassadorPageRef = {
    id: string;
    handle: string;
};

const AMBASSADOR_PAGE_BODY = "<frak-ambassador></frak-ambassador>";
const AMBASSADOR_TAG_OPENING = "<frak-ambassador";
const MAX_HANDLE_ATTEMPTS = 5;
const PAGES_LISTING_SIZE = 250;
/** Paired, self-closing, unclosed or stray closing: every form the `<frak-ambassador` test counts. */
const AMBASSADOR_TAG =
    /<frak-ambassador\b[^>]*>(?:\s*<\/frak-ambassador\s*>)?|<\/frak-ambassador\s*>/g;

const PAGE_COPY: Record<
    AmbassadorPageLanguage,
    { title: string; handle: string }
> = {
    en: { title: "Become an ambassador", handle: "become-an-ambassador" },
    fr: { title: "Devenir ambassadeur", handle: "devenir-ambassadeur" },
};

/** Every handle `createAmbassadorPage` can produce, in any language and retry. */
const CREATED_HANDLES = new Set(
    Object.values(PAGE_COPY).flatMap(({ handle }) => [
        handle,
        ...Array.from(
            { length: MAX_HANDLE_ATTEMPTS - 1 },
            (_, index) => `${handle}-${index + 2}`
        ),
    ])
);

type PageCreateUserError = { code?: string; message: string };

type PageCreateData = {
    pageCreate?: {
        page?: AmbassadorPageRef | null;
        userErrors?: PageCreateUserError[];
    } | null;
};

/**
 * Create the published ambassador page, on `template` with an empty body or,
 * without one, on the default template holding the component. A handle that
 * is `TAKEN` is retried with `-2` to `-5`; `null` on any other failure.
 */
export async function createAmbassadorPage(
    context: AuthenticatedContext,
    language: AmbassadorPageLanguage,
    template: string | null = null
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
                            ...(template
                                ? { body: "", templateSuffix: template }
                                : { body: AMBASSADOR_PAGE_BODY }),
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
    | {
          ok: true;
          url: string;
          templateSuffix: string | null;
          body: string;
      }
    | { ok: true; url: null }
    | { ok: false };

/**
 * Current storefront URL, template suffix and body of a recorded page. A read
 * failure is reported apart from a missing page, so callers never clear a
 * live URL on a blip.
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
    templateSuffix
    body
  }
}`,
            { variables: { id: pageId } }
        );
        const { data } = (await response.json()) as {
            data?: {
                page?: {
                    handle: string;
                    isPublished: boolean;
                    templateSuffix: string | null;
                    body: string;
                } | null;
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
            templateSuffix: page.templateSuffix,
            body: page.body,
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
    | { state: "none" }
    | {
          state: "upgrade";
          url: string;
          template: string | null;
          standardLayoutKept: boolean;
          /** On its own ambassador template, so the tag renders it twice. */
          onTemplate: boolean;
      }
    | { state: "blank"; url: string; template: string | null };

/**
 * Card state for the shop's ambassador page. With the page scopes granted, a
 * changed storefront URL is written back to the record, and the page's
 * template and body decide whether it is done, upgradable or blank.
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
                ...record,
                url: resolved.url,
            });
        }
        if (!resolved.url) {
            return unlinked;
        }

        const hasComponent = resolved.body.includes(AMBASSADOR_TAG_OPENING);
        const ownTemplate =
            resolved.templateSuffix !== null &&
            templateSuffixes.includes(resolved.templateSuffix)
                ? resolved.templateSuffix
                : null;
        if (ownTemplate && !hasComponent) {
            return { state: "linked", url: resolved.url };
        }
        const template =
            ownTemplate ?? pickAmbassadorTemplate(templateSuffixes);
        return hasComponent
            ? {
                  state: "upgrade",
                  url: resolved.url,
                  template,
                  // A dismissal never hides a double render.
                  standardLayoutKept:
                      !ownTemplate && record.standardLayoutKept === true,
                  onTemplate: ownTemplate !== null,
              }
            : { state: "blank", url: resolved.url, template };
    } catch (error) {
        log.error({ err: error }, "ambassador page reconcile error");
        return unlinked;
    }
}

export type AmbassadorPageActionResult =
    | { ok: true; url: string }
    | {
          ok: false;
          reason:
              | "createFailed"
              | "linkFailed"
              | "noPublishedPage"
              | "applyFailed"
              | "templateMissing"
              | "restoreFailed"
              | "keepFailed";
      };

/**
 * Write the page and its storefront URL, keeping `previous` (the record the
 * caller read) only for the same page: a dismissal belongs to one page. A
 * failed write is logged, not thrown: the URL is still returned.
 */
async function recordPage(
    context: AuthenticatedContext,
    page: AmbassadorPageRef,
    previous: AmbassadorPageRecord | null
): Promise<string> {
    const url = await buildAmbassadorPageUrl(context, page.handle);
    try {
        const result = await writeAmbassadorPageMetafield(context, {
            ...(previous?.pageId === page.id ? previous : {}),
            pageId: page.id,
            url,
        });
        if (!result.success) {
            log.error(
                { userErrors: result.userErrors, pageId: page.id },
                "ambassador page record rejected"
            );
        }
    } catch (error) {
        log.error(
            { err: error, pageId: page.id },
            "ambassador page record write error"
        );
    }
    return url;
}

/**
 * Create the ambassador page unless the record already names a live one. A
 * published page whose body is exactly the component tag, or with one of the
 * app's handles on an ambassador template, is adopted instead, so a lost
 * record write never leads to a duplicate page.
 */
export async function createAndRecordAmbassadorPage(
    context: AuthenticatedContext,
    language: AmbassadorPageLanguage
): Promise<AmbassadorPageActionResult> {
    try {
        const record = await getAmbassadorPageMetafield(context);
        if (record) {
            const resolved = await resolveAmbassadorPageUrl(
                context,
                record.pageId
            );
            if (!resolved.ok) {
                return { ok: false, reason: "createFailed" };
            }
            if (resolved.url) {
                return { ok: true, url: resolved.url };
            }
        }

        const { ambassador } = await getThemeBlockPresence(context);
        const existing = await findPublishedPage(
            context,
            (listed) =>
                listed.body.trim() === AMBASSADOR_PAGE_BODY ||
                (CREATED_HANDLES.has(listed.handle) &&
                    listed.templateSuffix !== null &&
                    ambassador.includes(listed.templateSuffix))
        );
        if (existing) {
            return {
                ok: true,
                url: await recordPage(context, existing, record),
            };
        }

        const page = await createAmbassadorPage(
            context,
            language,
            pickAmbassadorTemplate(ambassador)
        );
        if (!page) {
            return { ok: false, reason: "createFailed" };
        }
        return { ok: true, url: await recordPage(context, page, record) };
    } catch (error) {
        log.error({ err: error }, "ambassador page create action error");
        return { ok: false, reason: "createFailed" };
    }
}

/** Adopt the published page that uses a block template. */
export async function linkAmbassadorPage(
    context: AuthenticatedContext
): Promise<AmbassadorPageActionResult> {
    try {
        const [record, { ambassador }] = await Promise.all([
            getAmbassadorPageMetafield(context),
            getThemeBlockPresence(context),
        ]);
        const page = await findPublishedPageByTemplateSuffixes(
            context,
            ambassador
        );
        if (!page) {
            return { ok: false, reason: "noPublishedPage" };
        }
        return { ok: true, url: await recordPage(context, page, record) };
    } catch (error) {
        log.error({ err: error }, "ambassador page link action error");
        return { ok: false, reason: "linkFailed" };
    }
}

type PageUpdateData = {
    pageUpdate?: {
        page?: { id: string } | null;
        userErrors?: PageCreateUserError[];
    } | null;
};

/**
 * Send one `pageUpdate` on the recorded page with the fields `edit` derives
 * from its current body, and return the page URL. `null` when nothing is
 * recorded, the page is gone or unpublished, or the update is rejected.
 */
async function updateRecordedPage(
    context: AuthenticatedContext,
    edit: (body: string) => { templateSuffix: string; body: string }
): Promise<string | null> {
    const record = await getAmbassadorPageMetafield(context);
    if (!record) {
        return null;
    }
    const resolved = await resolveAmbassadorPageUrl(context, record.pageId);
    if (!(resolved.ok && resolved.url)) {
        return null;
    }

    const response = await context.admin.graphql(
        `#graphql
mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) {
    page {
      id
    }
    userErrors {
      code
      field
      message
    }
  }
}`,
        { variables: { id: record.pageId, page: edit(resolved.body) } }
    );
    const { data } = (await response.json()) as { data?: PageUpdateData };
    if (!data?.pageUpdate?.page) {
        log.error(
            { userErrors: data?.pageUpdate?.userErrors, pageId: record.pageId },
            "ambassador page update rejected"
        );
        return null;
    }
    return resolved.url;
}

/**
 * Move the recorded page onto `template` and remove the component from its
 * body, in one update. Refused unless `template` still holds the block.
 */
export async function applyAmbassadorTemplate(
    context: AuthenticatedContext,
    template: string
): Promise<AmbassadorPageActionResult> {
    try {
        const { ambassador } = await getThemeBlockPresence(context);
        if (!ambassador.includes(template)) {
            return { ok: false, reason: "templateMissing" };
        }
        const url = await updateRecordedPage(context, (body) => ({
            templateSuffix: template,
            body: body.replace(AMBASSADOR_TAG, ""),
        }));
        return url ? { ok: true, url } : { ok: false, reason: "applyFailed" };
    } catch (error) {
        log.error({ err: error }, "ambassador template apply error");
        return { ok: false, reason: "applyFailed" };
    }
}

/**
 * Put the component back in the recorded page's body, after any text, and
 * reset it to the default template.
 */
export async function restoreAmbassadorComponent(
    context: AuthenticatedContext
): Promise<AmbassadorPageActionResult> {
    try {
        const url = await updateRecordedPage(context, (body) => ({
            templateSuffix: "",
            body: body.includes(AMBASSADOR_TAG_OPENING)
                ? body
                : `${body}${AMBASSADOR_PAGE_BODY}`,
        }));
        return url ? { ok: true, url } : { ok: false, reason: "restoreFailed" };
    } catch (error) {
        log.error({ err: error }, "ambassador component restore error");
        return { ok: false, reason: "restoreFailed" };
    }
}

/** Store the merchant's choice to keep the standard layout, leaving the rest of the record. */
export async function keepStandardLayout(
    context: AuthenticatedContext
): Promise<AmbassadorPageActionResult> {
    try {
        const record = await getAmbassadorPageMetafield(context);
        if (!record?.url) {
            return { ok: false, reason: "keepFailed" };
        }
        const result = await writeAmbassadorPageMetafield(context, {
            ...record,
            standardLayoutKept: true,
        });
        if (!result.success) {
            log.error(
                { userErrors: result.userErrors, pageId: record.pageId },
                "ambassador standard layout choice rejected"
            );
            return { ok: false, reason: "keepFailed" };
        }
        return { ok: true, url: record.url };
    } catch (error) {
        log.error({ err: error }, "ambassador standard layout keep error");
        return { ok: false, reason: "keepFailed" };
    }
}
