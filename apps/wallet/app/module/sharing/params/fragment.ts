import { useEffect, useState } from "react";
import { FRAGMENT_KEYS, paramCodec, type SharingActivation } from "./table";

/**
 * Read the per-tap params out of a location fragment. Absent or rejected keys
 * are omitted rather than set to `undefined`, since the result is spread over
 * the warm page's params. `null` means no fragment at all.
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
 * Per-tap params delivered to an already-warmed page by fragment: a
 * same-document change, so no request, no remount, no React boot. Each
 * activation replaces the previous one rather than merging into it.
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
