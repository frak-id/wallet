/** Outcomes a native host is told about. `share`/`copy` are asks the SDK fulfils, not reports. */
export type HostResultAction =
    | "install"
    | "dismiss"
    | "shareAgain"
    | "share"
    | "copy"
    | "error"
    | "code"
    | "ready";

/** The resolved share payload carried on `action: "share"`; every field optional. */
export type HostShareResult = {
    title?: string;
    text?: string;
    image?: string;
};

/**
 * Build the URL that hands an outcome back to a native host. Only safe because
 * the host intercepts this navigation inside its own web view: elsewhere it
 * would be a real scheme launch, exposing `value` to any app claiming the scheme.
 */
export function buildHostResultUrl({
    scheme,
    action,
    sid,
    value,
    expiresAt,
    share,
}: {
    scheme: string;
    action: HostResultAction;
    sid?: string;
    /** The install code, for `action: "code"`. Ignored otherwise. */
    value?: string;
    /** When `value` stops being valid, as epoch seconds. */
    expiresAt?: number;
    /** The resolved share payload, for `action: "share"`. Ignored otherwise. */
    share?: HostShareResult;
}): string {
    const params = new URLSearchParams({ action });
    if (sid) params.set("sid", sid);
    if (action === "code" && value) {
        params.set("value", value);
        if (expiresAt !== undefined) params.set("exp", String(expiresAt));
    }
    if (action === "share" && share) {
        if (share.title) params.set("title", share.title);
        if (share.text) params.set("text", share.text);
        if (share.image) params.set("image", share.image);
    }
    return `${scheme}://result?${params}`;
}

/**
 * Outcomes already sent, keyed by session, action and value so a regenerated
 * code still gets through. Scoped by `sid` and not by action alone: a native
 * host pools its web view, so this module's state outlives the sheet.
 */
const sentActions = new Set<string>();

// A fragment activation re-presents this same document: the host clears its
// claimed buttons before re-activating (`shareAgain`), so outcomes sent to the
// previous presentation no longer bind this one. `hashchange` never fires on
// the initial load, so a first presentation keeps its dedupe.
if (typeof window !== "undefined") {
    window.addEventListener("hashchange", () => sentActions.clear());
}

/** Actions exempt from the dedupe: repeated presses, plus a per-presentation `ready` ping. */
const REPEATABLE_ACTIONS: ReadonlySet<HostResultAction> = new Set([
    "share",
    "copy",
    "ready",
]);

/**
 * Hand an outcome to the host, at most once per session bar
 * [REPEATABLE_ACTIONS]: the document stays alive while the host intercepts the
 * navigation, so a second tap would otherwise send a duplicate. Returns
 * whether it was issued.
 */
export function sendHostResult({
    scheme,
    action,
    sid,
    value,
    expiresAt,
    share,
}: {
    scheme?: string;
    action: HostResultAction;
    sid?: string;
    value?: string;
    expiresAt?: number;
    share?: HostShareResult;
}): boolean {
    if (!scheme) return false;
    if (!REPEATABLE_ACTIONS.has(action)) {
        const key = [sid ?? "", action, value ?? ""].join("\u0000");
        if (sentActions.has(key)) return true;
        sentActions.add(key);
    }
    window.location.assign(
        buildHostResultUrl({ scheme, action, sid, value, expiresAt, share })
    );
    return true;
}

/** Test seam: forget what has been sent. */
export function resetHostResults() {
    sentActions.clear();
}
