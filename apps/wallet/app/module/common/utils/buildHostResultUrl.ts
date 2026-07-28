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
