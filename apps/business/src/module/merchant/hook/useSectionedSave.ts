import { useCallback, useMemo, useRef, useState } from "react";

type SectionSubmit = () => Promise<void>;

/**
 * Page-level save orchestration for the merchant Edit pages: sections
 * register their submit handler through `CustomizeSaveProvider` and this
 * hook aggregates their dirty state behind a single Save button.
 */
export function useSectionedSave() {
    const [dirtySections, setDirtySections] = useState<Record<string, boolean>>(
        {}
    );
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    // Lazy init: useRef(new Map()) would rebuild and discard the Map on
    // every render.
    const submitHandlers = useRef<Map<string, SectionSubmit> | null>(null);
    if (submitHandlers.current === null) {
        submitHandlers.current = new Map();
    }
    const handlers = submitHandlers.current;

    const onDirtyChange = useCallback((key: string, isDirty: boolean) => {
        setDirtySections((prev) => {
            if (prev[key] === isDirty) return prev;
            return { ...prev, [key]: isDirty };
        });
    }, []);

    const registerSection = useCallback(
        (key: string, submit: SectionSubmit) => {
            handlers.set(key, submit);
            return () => {
                if (handlers.get(key) === submit) {
                    handlers.delete(key);
                }
            };
        },
        [handlers]
    );

    const saveContext = useMemo(
        () => ({ registerSection, onDirtyChange }),
        [registerSection, onDirtyChange]
    );

    const hasUnsavedChanges = useMemo(
        () => Object.values(dirtySections).some(Boolean),
        [dirtySections]
    );

    const saveAll = useCallback(async () => {
        setIsSaving(true);
        setSaveError(false);
        try {
            // Sequential on purpose: the backend merges each update over a
            // fresh read of the stored config, so concurrent saves would
            // drop fields.
            for (const [key, isDirty] of Object.entries(dirtySections)) {
                if (!isDirty) continue;
                try {
                    await handlers.get(key)?.();
                } catch {
                    // Failed/invalid section stays dirty; keep saving the rest.
                    setSaveError(true);
                }
            }
        } finally {
            setIsSaving(false);
        }
    }, [dirtySections, handlers]);

    return {
        saveContext,
        dirtySections,
        hasUnsavedChanges,
        isSaving,
        saveError,
        saveAll,
    };
}
