import { isProd } from "./env";
import { MENU_SCOPES, PAGE_SCOPES, PROXY_SCOPES } from "./optionalScopes";

/** Storefront path of the ambassador page; must match `[app_proxy]` prefix/subpath of the stage's toml. */
export function ambassadorProxyPath(): string {
    return isProd() ? "/apps/ambassador" : "/apps/ambassador-dev";
}

export type AmbassadorPageLanguage = "en" | "fr";

/** `fr` for any French locale tag, `en` otherwise. */
export function ambassadorPageLanguage(
    value: string | null | undefined
): AmbassadorPageLanguage {
    return value?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** Title of the main-menu link; the checkbox label shows the same string. */
export function ambassadorMenuTitle(language: AmbassadorPageLanguage): string {
    return language === "fr" ? "Devenir ambassadeur" : "Become an ambassador";
}

export type AmbassadorPageStatus = "draft" | "hidden" | "live" | "oldPage";

export type AmbassadorMenuState = "added" | "missing" | "none";

export type AmbassadorPageOverview = {
    status: AmbassadorPageStatus;
    /** Primary domain URL plus `path`. */
    url: string;
    path: string;
    /** Storefront URL of the `/pages/` page a v1 record points to. */
    oldPageUrl: string | null;
    /** `none` when no link is recorded or the menu scope is not granted. */
    menu: { state: AmbassadorMenuState };
    /** All false when the granted scopes could not be read. */
    scopes: { proxy: boolean; menu: boolean; pages: boolean };
};

/** `locked` is a password-protected storefront; `unknown` a probe that could not conclude. */
export type AmbassadorProbe = "live" | "missing" | "locked" | "unknown";

export type AmbassadorPageIntent = "publish" | "hide" | "addToMenu" | "switch";

/** A step that failed without failing the action. */
export type AmbassadorPageWarning =
    | "menuRemoveFailed"
    | "repointFailed"
    | "oldPageHideFailed"
    | "redirectFailed"
    | "recordFailed";

export type AmbassadorPageActionResult =
    | {
          ok: true;
          intent: AmbassadorPageIntent;
          url?: string;
          menu?: "added" | "failed" | "skipped";
          warnings?: AmbassadorPageWarning[];
      }
    | {
          ok: false;
          intent: AmbassadorPageIntent;
          error: "scopeMissing" | "failed" | "invalid";
      };

/** Optional scopes to request before submitting `intent`. */
export function scopesForIntent(
    intent: AmbassadorPageIntent,
    { addToMenu }: { addToMenu: boolean }
): string[] {
    switch (intent) {
        case "publish":
            return addToMenu
                ? [...PROXY_SCOPES, ...MENU_SCOPES]
                : [...PROXY_SCOPES];
        case "addToMenu":
            return [...MENU_SCOPES];
        case "hide":
            return [];
        case "switch":
            return [...PROXY_SCOPES, ...MENU_SCOPES, ...PAGE_SCOPES];
    }
}
