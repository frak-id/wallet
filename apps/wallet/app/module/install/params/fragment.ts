import { useEffect, useState } from "react";
import {
    INSTALL_PARAMS,
    type InstallActivation,
    type InstallParamKey,
    installParamCodec,
} from "./table";

/**
 * Read the post-install probe's params out of a location fragment. Absent
 * keys are omitted rather than set to `undefined`, matching the sharing
 * page's contract: a same-document rewrite always re-emits the whole set,
 * so an absent key here means the host never sent one, not that it was
 * cleared.
 */
export function parseInstallFragment(hash: string): InstallActivation | null {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;

    const params = new URLSearchParams(raw);
    const activation: Record<string, unknown> = {};

    for (const key of Object.keys(INSTALL_PARAMS) as InstallParamKey[]) {
        if (!params.has(key)) continue;
        const decoded = installParamCodec(key).decode(params.get(key));
        if (decoded !== undefined) activation[key] = decoded;
    }

    return activation as InstallActivation;
}

/**
 * The install page's post-install state, delivered by the same-document
 * fragment rewrite `InstallProbe` performs on detection. `null` until a
 * fragment carrying `installed` has been seen.
 */
export function useInstallActivation(
    enabled: boolean
): InstallActivation | null {
    const [activation, setActivation] = useState<InstallActivation | null>(
        () =>
            enabled && typeof window !== "undefined"
                ? parseInstallFragment(window.location.hash)
                : null
    );

    useEffect(() => {
        if (!enabled) return;
        const onHashChange = () =>
            setActivation(parseInstallFragment(window.location.hash));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [enabled]);

    return activation;
}
