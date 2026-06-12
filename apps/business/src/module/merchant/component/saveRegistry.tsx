import { createContext, useContext, useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

type SectionSubmit = () => Promise<void>;

type CustomizeSaveContextValue = {
    /** Register a section's submit handler; returns the unregister cleanup. */
    registerSection: (key: string, submit: SectionSubmit) => () => void;
    onDirtyChange: (key: string, isDirty: boolean) => void;
};

const CustomizeSaveContext = createContext<CustomizeSaveContextValue | null>(
    null
);

export const CustomizeSaveProvider = CustomizeSaveContext.Provider;

function useCustomizeSave(): CustomizeSaveContextValue {
    const context = useContext(CustomizeSaveContext);
    if (!context) {
        throw new Error(
            "useCustomizeSection must be used within CustomizePage"
        );
    }
    return context;
}

/**
 * Wire a section form into the page-level Save button: registers the submit
 * handler and keeps the aggregated dirty state in sync. `onValid` must be
 * stable (useCallback) and await the mutation (`mutateAsync`).
 */
export function useCustomizeSection<T extends FieldValues>(
    key: string,
    form: UseFormReturn<T>,
    onValid: (values: T) => Promise<unknown>
) {
    const { registerSection, onDirtyChange } = useCustomizeSave();

    useEffect(
        () =>
            registerSection(key, async () => {
                await form.handleSubmit(
                    async (values) => {
                        await onValid(values);
                    },
                    // Reject so the page-level save surfaces the failure
                    // instead of silently skipping an invalid section.
                    () => {
                        throw new Error(`Section "${key}" is invalid`);
                    }
                )();
            }),
        [registerSection, key, form, onValid]
    );

    useEffect(() => {
        onDirtyChange(key, form.formState.isDirty);
        return () => onDirtyChange(key, false);
    }, [key, onDirtyChange, form.formState.isDirty]);
}
