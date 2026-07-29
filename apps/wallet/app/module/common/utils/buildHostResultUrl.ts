/**
 * Outcomes a native host is told about.
 *
 * `shared` and `copied` are absent on purpose: the host owns those controls
 * and already knows. `error` reports a rejected launch, so the host can close
 * its sheet instead of leaving it on a page it cannot interpret.
 */
export type HostResultAction = "install" | "dismiss" | "shareAgain" | "error";

/**
 * Build the URL that hands an outcome back to a native host.
 *
 * The host intercepts this navigation inside its own web view. Nothing
 * capability-bearing goes on it: a custom scheme carries no origin, so any page
 * or app could forge the same call. Only the action and the host's own `sid`
 * travel, and the host drops callbacks whose `sid` does not match the session
 * it opened.
 */
export function buildHostResultUrl({
    scheme,
    action,
    sid,
}: {
    scheme: string;
    action: HostResultAction;
    sid?: string;
}): string {
    const params = new URLSearchParams({ action });
    if (sid) params.set("sid", sid);
    return `${scheme}://result?${params}`;
}

/** Outcomes already handed to the host, so none is sent twice. */
const sentActions = new Set<HostResultAction>();

/**
 * Hand an outcome to the host, at most once per page.
 *
 * Route guards are not navigations: the router re-runs `beforeLoad` whenever
 * it resolves the location again, and it does so on load because
 * `validateSearch` fills in absent flags, which rewrites the URL. A guard that
 * navigated on every run therefore fired the same outcome twice, and the host
 * cannot tell the copies apart since both carry the session's own `sid`.
 *
 * Returns whether the navigation was issued, so callers can fall through to
 * their web behaviour when there is no host to hand off to.
 */
export function sendHostResult({
    scheme,
    action,
    sid,
}: {
    scheme?: string;
    action: HostResultAction;
    sid?: string;
}): boolean {
    if (!scheme) return false;
    if (sentActions.has(action)) return true;
    sentActions.add(action);
    window.location.assign(buildHostResultUrl({ scheme, action, sid }));
    return true;
}

/** Test seam: forget what has been sent. */
export function resetHostResults() {
    sentActions.clear();
}
