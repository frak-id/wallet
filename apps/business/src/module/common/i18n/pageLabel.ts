import type { TFunction } from "i18next";

export type PageKey =
    | "dashboard"
    | "campaigns"
    | "campaignsOverview"
    | "campaignsList"
    | "members"
    | "wallet"
    | "settings"
    | "merchant"
    | "push"
    | "pushCreate"
    | "pushConfirm";

export type SectionKey = "acquisition" | "preview";

// Pages that ship a dedicated standalone title (h1) different from their
// sidebar/header nav label. Anything not in this set falls back to `nav`.
type PageWithTitle = "campaignsList" | "members";

const PAGES_WITH_TITLE: ReadonlySet<PageKey> = new Set<PageKey>([
    "campaignsList",
    "members",
]);

export function pageNav(t: TFunction, key: PageKey): string {
    return t(`shell.pages.${key}.nav`);
}

export function pageTitle(t: TFunction, key: PageKey): string {
    if (PAGES_WITH_TITLE.has(key)) {
        return t(`shell.pages.${key as PageWithTitle}.title`);
    }
    return t(`shell.pages.${key}.nav`);
}

export function sectionLabel(t: TFunction, key: SectionKey): string {
    return t(`shell.sections.${key}`);
}
