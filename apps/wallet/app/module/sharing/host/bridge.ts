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
}: {
    scheme: string;
    action: HostResultAction;
    sid?: string;
    /** The install code, for `action: "code"`. Ignored otherwise. */
    value?: string;
    /** When `value` stops being valid, as epoch seconds. */
    expiresAt?: number;
}): string {
    const params = new URLSearchParams({ action });
    if (sid) params.set("sid", sid);
    if (action === "code" && value) {
        params.set("value", value);
        if (expiresAt !== undefined) params.set("exp", String(expiresAt));
    }
    return `${scheme}://result?${params}`;
}

/**
 * Outcomes already sent, keyed by session, action and value so a regenerated
 * code still gets through.
 *
 * Scoped by `sid` and not just by action: a native host pools its web view and
 * puts the same document in front of the next sheet, so this module's state
 * outlives the presentation that filled it. Keyed by action alone, the second
 * sheet's Install tap is swallowed here and never reaches the SDK — the button
 * is simply dead, with nothing in either log to say why.
 */
const sentActions = new Set<string>();

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
}: {
    scheme?: string;
    action: HostResultAction;
    sid?: string;
    value?: string;
    expiresAt?: number;
}): boolean {
    if (!scheme) return false;
    if (!REPEATABLE_ACTIONS.has(action)) {
        const key = [sid ?? "", action, value ?? ""].join("\u0000");
        if (sentActions.has(key)) return true;
        sentActions.add(key);
    }
    window.location.assign(
        buildHostResultUrl({ scheme, action, sid, value, expiresAt })
    );
    return true;
}

/** Test seam: forget what has been sent. */
export function resetHostResults() {
    sentActions.clear();
}
