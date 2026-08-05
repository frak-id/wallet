import { useEffect, useState } from "react";
import { FRAGMENT_KEYS, paramCodec, type SharingActivation } from "./table";

/**
 * Read the per-tap params out of a location fragment.
 *
 * ## The omit-absent-keys contract
 *
 * Only keys the fragment actually carries — and whose codec accepted the value
 * — are written. That is load-bearing rather than tidy: the result is spread
 * over the query-string params, so a key present-and-`undefined` would erase
 * the warmed value underneath it instead of leaving it alone. `logoUrl` and
 * `appName` come from the merchant config on the warm URL, and most
 * activations have nothing to say about them.
 *
 * The same applies to a value the codec rejects: a garbled `products` or an
 * unsafe `seedReward` costs us that one param, not the warm page's own good
 * value for it. Enforced here by construction, for every key at once, rather
 * than remembered per param.
 *
 * `fragmentDefault` is the deliberate exception — see `state` in the table.
 *
 * Returns `null` for an empty fragment so callers can tell "no activation"
 * from "an activation that happens to carry nothing".
 */
export function parseSharingFragment(hash: string): SharingActivation | null {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;

    const params = new URLSearchParams(raw);
    const activation: Record<string, unknown> = {};

    for (const key of FRAGMENT_KEYS) {
        const codec = paramCodec(key);
        const present = params.has(key);

        if (!present) {
            if (codec.fragmentDefault !== undefined) {
                activation[key] = codec.fragmentDefault;
            }
            continue;
        }

        const decoded = codec.decode(params.get(key));
        if (decoded !== undefined) activation[key] = decoded;
    }

    return activation as SharingActivation;
}

/**
 * The params a warmed page is still missing, delivered by fragment rather than
 * by loading the page again.
 *
 * A native host warms this page against the real merchant so the bundle,
 * React, i18n and the merchant-keyed queries are all done before the user
 * taps. Everything left is per-tap — the link, the products, the seeded
 * headline, the session token — and putting those in the query string would
 * mean a second document load, which is the ~300ms this exists to avoid. A
 * fragment change is same-document: no request, no remount, no React boot.
 *
 * Each activation replaces the previous one rather than merging into it. The
 * pooled page outlives any one sheet, so a merge would let a stale `products`
 * from the last sheet ride along into the next; hosts send the complete
 * per-tap set every time.
 *
 * Note for hosts: two identical fragments in a row fire no `hashchange`. `sid`
 * is minted per session, so in practice they always differ — but a host
 * reusing one must vary something.
 */
export function useActivationParams(
    enabled: boolean
): SharingActivation | null {
    const [params, setParams] = useState<SharingActivation | null>(() =>
        enabled && typeof window !== "undefined"
            ? parseSharingFragment(window.location.hash)
            : null
    );

    useEffect(() => {
        if (!enabled) return;
        const onHashChange = () =>
            setParams(parseSharingFragment(window.location.hash));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [enabled]);

    return params;
}
