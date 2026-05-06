import { useEffect, useState } from "react";
import { useVersionGate } from "../hook/useVersionGate";
import { HardUpdateGate } from "./HardUpdateGate";
import { SoftUpdatePrompt } from "./SoftUpdatePrompt";

/**
 * Top-level mount point for the version gate. Renders the right native UI
 * based on `useVersionGate`'s combined state, or `null` when nothing needs
 * to be surfaced.
 *
 * Soft-prompt dismissal is intentionally session-scoped (in-memory state):
 * the banner re-appears the next time the wallet is foregrounded so the
 * user keeps getting nudged without us persisting per-version flags. The
 * `dismissedFor` key resets when a newer store version is reported.
 */
export function VersionGate() {
    const state = useVersionGate();
    const [dismissedFor, setDismissedFor] = useState<string | null>(null);

    // Reset dismissal whenever the store advertises a newer release than
    // the one the user previously dismissed — staying silent across
    // multiple versions defeats the purpose of the prompt.
    useEffect(() => {
        if (state.kind !== "soft_update") return;
        if (
            dismissedFor !== null &&
            state.storeVersion !== undefined &&
            state.storeVersion !== dismissedFor
        ) {
            setDismissedFor(null);
        }
    }, [state, dismissedFor]);

    if (state.kind === "hard_update") {
        return (
            <HardUpdateGate
                currentVersion={state.currentVersion}
                minVersion={state.minVersion}
            />
        );
    }

    if (state.kind === "soft_update_in_progress") {
        return (
            <SoftUpdatePrompt
                mode="in_progress"
                bytesDownloaded={state.bytesDownloaded}
                totalBytes={state.totalBytes}
            />
        );
    }

    if (state.kind === "soft_update_downloaded") {
        return <SoftUpdatePrompt mode="downloaded" />;
    }

    if (state.kind === "soft_update") {
        if (dismissedFor === (state.storeVersion ?? "available")) return null;
        return (
            <SoftUpdatePrompt
                mode="available"
                storeVersion={state.storeVersion}
                onDismiss={() =>
                    setDismissedFor(state.storeVersion ?? "available")
                }
            />
        );
    }

    return null;
}
